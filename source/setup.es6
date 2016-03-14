import * as R from 'ramda';
import { shuffle, random, randomInteger, untilDifferent } from 'utils';

export function emptyPair() {
    return {
        relationship: {
            table: 'relationships',
            category: null,
            element: null
        },
        detail: {
            table: null,
            category: null,
            element: null
        }
    };
}

export function showPair(playset, pair) {
    return {
        relationship: showItem(playset, pair.relationship),
        detail: showItem(playset, pair.detail)
    };
}

export function showItem(playset, item) {
    return {
        table: item.table,
        category: showCategory(playset, item.table, item.category),
        element: showElement(playset, item.table, item.category, item.element)
    };
}

function showCategory(playset, table, category) {
    return table === null || category === null ? null :  {
        name: playset.tables[table].categories[category],
        die: category + 1
    };
}

function showElement(playset, table, category, element) {
    return table === null || element === null ? null : {
        name: playset.tables[table].elements[category][element],
        die: element + 1
    };
}

export function randomSetup(playerCount, maxPlayerCount) {
    const detailTypes = randomDetailTypes(playerCount, maxPlayerCount);
    return detailTypes.map(randomPair);
}

function randomPair(detailType) {
    return {
        relationship: randomItem('relationships'),
        detail: randomItem(detailType)
    };
}

// This function randomizes detail types for all pairs (five), even when only
// three or four are active, but uses the current number of players to ensure a
// good selection of types.
function randomDetailTypes(playerCount, maxPlayerCount) {
    // First decide which types will be present, using the suggestions defined
    // in the Fiasco book. In other words: at least one of each type, then an
    // additional need, then an additional location or object.
    const types = [
        'needs',
        'locations',
        'objects',
        'needs',
        random(['locations', 'objects'])
    ];

    // Randomly place the types in the setup, based on the current number of
    // players. We need to make sure that the setup gets the detail types
    // suggested for its number of players, so we place them in the order used
    // above.
    const order = shuffle(R.range(0, playerCount));
    const active = order.map(index => types[index]);

    // Place the remaining types in the default order, because we want to
    // make sure that they are present if the number of players is
    // increased.
    const extra = R.range(playerCount, maxPlayerCount).map(index => types[index]);
    
    return active.concat(extra);
}

function randomItem(table) {
    return {
        table: table,
        category: rollDie(),
        element: rollDie()
    };
}

export function randomCategory(table, current) {
    return {
        table: table,
        category: untilDifferent(current, rollDie),
        element: null
    };
}

export function randomElement(table, category, current) {
    return {
        table: table,
        category: category === null ? rollDie() : category,
        element: untilDifferent(current, rollDie)
    };
}

function rollDie() {
    return randomInteger(5);
}
