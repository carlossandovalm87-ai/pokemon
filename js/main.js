const API_URL = "https://pokeapi.co/api/v2";
const PAGE_SIZE = 24;
const typeNames = {
    normal: "Normal",
    fire: "Fuego",
    water: "Agua",
    electric: "Eléctrico",
    grass: "Planta",
    ice: "Hielo",
    fighting: "Lucha",
    poison: "Veneno",
    ground: "Tierra",
    flying: "Volador",
    psychic: "Psíquico",
    bug: "Bicho",
    rock: "Roca",
    ghost: "Fantasma",
    dragon: "Dragón",
    dark: "Siniestro",
    steel: "Acero",
    fairy: "Hada"
};

const form = document.getElementById("filters-form");
const searchInput = document.getElementById("pokemon-search");
const typeFilter = document.getElementById("type-filter");
const clearButton = document.getElementById("clear-filters");
const loadMoreButton = document.getElementById("load-more");
const grid = document.getElementById("pokemon-grid");
const statusMessage = document.getElementById("results-status");
const errorMessage = document.getElementById("error-message");
const randomPokemonButton = document.getElementById("random-pokemon-button");
const randomPokemonStatus = document.getElementById("random-status");
const randomPokemonResult = document.getElementById("random-pokemon-result");
const sectionNavigationLinks = document.querySelectorAll(
    '.site-nav .nav-link[href^="#"]'
);
const pokemonDialog = document.getElementById("pokemon-dialog");
const pokemonDetails = document.getElementById("pokemon-details");
const closePokemonDialogButton = document.getElementById("close-pokemon-dialog");
const statNames = {
    hp: "PS",
    attack: "Ataque",
    defense: "Defensa",
    "special-attack": "Ataque especial",
    "special-defense": "Defensa especial",
    speed: "Velocidad"
};

let pokemonCatalog = [];
let currentCatalog = [];
let filteredCatalog = [];
let displayedPokemon = [];
let totalPokemon = 0;
let nextIndex = 0;
let isLoading = false;
let isFiltering = false;
let catalogGeneration = 0;
let typeRequestId = 0;
let randomPokemon = null;
let randomRequestId = 0;

function updateSectionNavigation() {
    const activeHash = window.location.hash || "#pokedex";
    sectionNavigationLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === activeHash;
        link.classList.toggle("nav-link-active", isActive);
        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`La solicitud falló (${response.status}).`);
    }
    return response.json();
}

function getPokemonId(url) {
    const match = url.match(/\/(\d+)\/?$/);
    return match ? Number(match[1]) : 0;
}

function setError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

function clearError() {
    errorMessage.textContent = "";
    errorMessage.hidden = true;
}

function updateStatus() {
    if (isFiltering) {
        loadMoreButton.hidden = true;
        loadMoreButton.disabled = true;
        return;
    }

    const resultCount = filteredCatalog.length;
    if (resultCount === 0) {
        statusMessage.textContent = "No se encontraron Pokémon con esos filtros.";
    } else {
        statusMessage.textContent =
            `Mostrando ${displayedPokemon.length} de ${resultCount} Pokémon`;
    }

    loadMoreButton.hidden = isLoading || nextIndex >= resultCount || resultCount === 0;
    loadMoreButton.disabled = isLoading;
}

function createPokemonCard(pokemon) {
    const card = document.createElement("article");
    card.className = "pokemon-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute(
        "aria-label",
        `Ver información de ${pokemon.name}, número ${pokemon.id}`
    );
    card.dataset.pokemonId = String(pokemon.id);

    const art = document.createElement("div");
    art.className = "pokemon-art";

    const image = document.createElement("img");
    image.src =
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;
    image.alt = pokemon.name;
    image.loading = "lazy";
    art.append(image);

    const number = document.createElement("p");
    number.className = "pokemon-number";
    number.textContent = `N.º ${String(pokemon.id).padStart(4, "0")}`;

    const name = document.createElement("h3");
    name.className = "pokemon-name";
    name.textContent = pokemon.name;

    const types = document.createElement("div");
    types.className = "pokemon-types";
    types.setAttribute("aria-label", "Tipos");
    pokemon.types.forEach(({ type }) => {
        const badge = document.createElement("span");
        badge.className = `type-badge type-${type.name}`;
        badge.textContent = typeNames[type.name] || type.name;
        types.append(badge);
    });

    card.append(art, number, name, types);
    return card;
}

function addDetailRow(container, label, value) {
    const row = document.createElement("div");
    row.className = "detail-row";

    const term = document.createElement("dt");
    term.textContent = label;

    const description = document.createElement("dd");
    description.textContent = value;

    row.append(term, description);
    container.append(row);
}

function openPokemonDetails(pokemon) {
    pokemonDetails.replaceChildren();

    const header = document.createElement("div");
    header.className = "dialog-pokemon-header";

    const image = document.createElement("img");
    image.className = "dialog-pokemon-image";
    image.src =
        pokemon.sprites.other?.["official-artwork"]?.front_default ||
        pokemon.sprites.front_default ||
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
    image.alt = pokemon.name;

    const heading = document.createElement("div");
    const number = document.createElement("p");
    number.className = "pokemon-number";
    number.textContent = `N.º ${String(pokemon.id).padStart(4, "0")}`;

    const title = document.createElement("h2");
    title.className = "dialog-title";
    title.textContent = pokemon.name;

    const types = document.createElement("div");
    types.className = "pokemon-types";
    pokemon.types.forEach(({ type }) => {
        const badge = document.createElement("span");
        badge.className = `type-badge type-${type.name}`;
        badge.textContent = typeNames[type.name] || type.name;
        types.append(badge);
    });

    heading.append(number, title, types);
    header.append(image, heading);

    const measurements = document.createElement("dl");
    measurements.className = "pokemon-measurements";
    addDetailRow(measurements, "Altura", `${(pokemon.height / 10).toFixed(1)} m`);
    addDetailRow(measurements, "Peso", `${(pokemon.weight / 10).toFixed(1)} kg`);
    addDetailRow(
        measurements,
        "Habilidades",
        pokemon.abilities
            .map(({ ability }) => ability.name.replaceAll("-", " "))
            .join(", ")
    );

    const statsSection = document.createElement("section");
    statsSection.className = "pokemon-stats";
    const statsTitle = document.createElement("h3");
    statsTitle.className = "details-section-title";
    statsTitle.textContent = "Estadísticas base";

    const statsList = document.createElement("dl");
    statsList.className = "stats-list";
    pokemon.stats.forEach(({ base_stat: baseStat, stat }) => {
        const row = document.createElement("div");
        row.className = "stat-row";

        const label = document.createElement("dt");
        label.textContent = statNames[stat.name] || stat.name;

        const value = document.createElement("dd");
        value.textContent = String(baseStat);

        const bar = document.createElement("span");
        bar.className = "stat-bar";
        const fill = document.createElement("span");
        fill.className = "stat-bar-fill";
        fill.style.width = `${Math.min(baseStat / 2.55, 100)}%`;
        bar.append(fill);

        row.append(label, value, bar);
        statsList.append(row);
    });
    statsSection.append(statsTitle, statsList);

    pokemonDetails.append(header, measurements, statsSection);
    pokemonDialog.showModal();
}

function createMissingPokemonState() {
    const state = document.createElement("article");
    state.className = "missingno-state";

    const image = document.createElement("img");
    image.src = "./assets/img/MissingNO.webp";
    image.alt = "MissingNo.";

    const message = document.createElement("p");
    message.textContent = "esa webada no existe";

    state.append(image, message);
    return state;
}

function renderPokemon() {
    const cards = displayedPokemon.map(createPokemonCard);
    if (filteredCatalog.length === 0 && searchInput.value.trim() !== "") {
        cards.push(createMissingPokemonState());
    }
    grid.replaceChildren(...cards);
    updateStatus();
}

grid.addEventListener("click", (event) => {
    const card = event.target.closest(".pokemon-card");
    if (!card || !grid.contains(card)) {
        return;
    }

    const pokemon = displayedPokemon.find(
        (entry) => entry.id === Number(card.dataset.pokemonId)
    );
    if (pokemon) {
        openPokemonDetails(pokemon);
    }
});

grid.addEventListener("keydown", (event) => {
    if (
        (event.key === "Enter" || event.key === " ") &&
        event.target.matches(".pokemon-card")
    ) {
        event.preventDefault();
        event.target.click();
    }
});

randomPokemonResult.addEventListener("click", (event) => {
    const card = event.target.closest(".pokemon-card");
    if (card && randomPokemon) {
        openPokemonDetails(randomPokemon);
    }
});

randomPokemonResult.addEventListener("keydown", (event) => {
    if (
        (event.key === "Enter" || event.key === " ") &&
        event.target.matches(".pokemon-card") &&
        randomPokemon
    ) {
        event.preventDefault();
        openPokemonDetails(randomPokemon);
    }
});

randomPokemonButton.addEventListener("click", async () => {
    if (pokemonCatalog.length === 0 || randomPokemonButton.disabled) {
        return;
    }

    const requestId = ++randomRequestId;
    randomPokemonButton.disabled = true;
    randomPokemonButton.classList.add("is-spinning");
    randomPokemonStatus.textContent = "Buscando un Pokémon...";

    try {
        let candidate;
        do {
            candidate = pokemonCatalog[Math.floor(Math.random() * pokemonCatalog.length)];
        } while (pokemonCatalog.length > 1 && getPokemonId(candidate.url) === randomPokemon?.id);

        const pokemon = await fetchJson(candidate.url);
        if (requestId !== randomRequestId) {
            return;
        }

        randomPokemon = pokemon;
        randomPokemonResult.replaceChildren(createPokemonCard(pokemon));
        randomPokemonStatus.textContent = "¡Este es tu Pokémon! Pulsa su tarjeta para ver sus datos.";
    } catch (error) {
        if (requestId === randomRequestId) {
            randomPokemonStatus.textContent =
                "No se pudo encontrar un Pokémon. Comprueba tu conexión e inténtalo de nuevo.";
            console.error("Error al buscar un Pokémon aleatorio:", error);
        }
    } finally {
        if (requestId === randomRequestId) {
            randomPokemonButton.disabled = false;
            randomPokemonButton.classList.remove("is-spinning");
        }
    }
});

closePokemonDialogButton.addEventListener("click", () => {
    pokemonDialog.close();
});

pokemonDialog.addEventListener("click", (event) => {
    if (event.target === pokemonDialog) {
        pokemonDialog.close();
    }
});

window.addEventListener("hashchange", updateSectionNavigation);
updateSectionNavigation();

async function loadNextPage() {
    if (isLoading || isFiltering || nextIndex >= filteredCatalog.length) {
        return;
    }

    isLoading = true;
    const requestGeneration = catalogGeneration;
    clearError();
    statusMessage.textContent = "Cargando Pokémon...";
    loadMoreButton.hidden = true;

    try {
        const page = filteredCatalog.slice(nextIndex, nextIndex + PAGE_SIZE);
        const pokemon = await Promise.all(
            page.map(({ url }) => fetchJson(url))
        );
        if (requestGeneration !== catalogGeneration) {
            return;
        }
        displayedPokemon.push(...pokemon);
        nextIndex += page.length;
        renderPokemon();
    } catch (error) {
        if (requestGeneration === catalogGeneration) {
            setError("No se pudieron cargar los Pokémon. Comprueba tu conexión e inténtalo de nuevo.");
            console.error("Error al cargar Pokémon:", error);
        }
    } finally {
        isLoading = false;
        updateStatus();
        if (requestGeneration !== catalogGeneration && !isFiltering) {
            loadNextPage();
        }
    }
}

function applySearch() {
    catalogGeneration += 1;
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    const numberQuery = query.replace(/^#/, "");
    const numericQuery = /^\d+$/.test(numberQuery)
        ? String(Number(numberQuery))
        : "";
    filteredCatalog = currentCatalog.filter(({ name, url }) => {
        const id = String(getPokemonId(url));
        return name.includes(query) || (numericQuery !== "" && id === numericQuery);
    });
    displayedPokemon = [];
    nextIndex = 0;
    clearError();
    renderPokemon();

    if (filteredCatalog.length > 0) {
        loadNextPage();
    }
}

async function applyTypeFilter() {
    const requestId = ++typeRequestId;
    catalogGeneration += 1;
    clearError();
    if (!typeFilter.value) {
        isFiltering = false;
        currentCatalog = pokemonCatalog;
        applySearch();
        return;
    }

    isFiltering = true;
    statusMessage.textContent = "Buscando por tipo...";
    loadMoreButton.hidden = true;

    try {
        const typeData = await fetchJson(`${API_URL}/type/${typeFilter.value}`);
        if (requestId !== typeRequestId) {
            return;
        }
        currentCatalog = typeData.pokemon
            .map(({ pokemon }) => pokemon)
            .sort((a, b) => getPokemonId(a.url) - getPokemonId(b.url));
        isFiltering = false;
        applySearch();
    } catch (error) {
        if (requestId === typeRequestId) {
            isFiltering = false;
            setError("No se pudo aplicar el filtro de tipo. Inténtalo de nuevo.");
            statusMessage.textContent = "No se pudieron cargar los resultados.";
            console.error("Error al filtrar Pokémon por tipo:", error);
        }
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch();
});

typeFilter.addEventListener("change", applyTypeFilter);

clearButton.addEventListener("click", () => {
    typeRequestId += 1;
    isFiltering = false;
    searchInput.value = "";
    typeFilter.value = "";
    currentCatalog = pokemonCatalog;
    applySearch();
});

loadMoreButton.addEventListener("click", loadNextPage);

async function initializePokedex() {
    try {
        const catalogData = await fetchJson(`${API_URL}/pokemon?limit=2000`);
        pokemonCatalog = catalogData.results;
        currentCatalog = pokemonCatalog;
        totalPokemon = catalogData.count;
        filteredCatalog = pokemonCatalog;
        randomPokemonButton.disabled = false;
        randomPokemonStatus.textContent = "Pulsa la Pokébola para descubrir un Pokémon.";
        statusMessage.textContent = `Cargando Pokémon (0 de ${totalPokemon})...`;
        await loadNextPage();
    } catch (error) {
        randomPokemonStatus.textContent =
            "No se pudo cargar la Pokédex para elegir un Pokémon aleatorio.";
        statusMessage.textContent = "No se pudo cargar la Pokédex.";
        setError("No se pudo conectar con PokeAPI. Comprueba tu conexión e inténtalo de nuevo.");
        console.error("Error al iniciar la Pokédex:", error);
    }
}

initializePokedex();
