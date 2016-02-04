import R from 'ramda';

export function random(array) {
    const max = array.length - 1;
    const index = randomInteger(max);
    return array[index];
}

export function randomInteger(max) {
    return Math.floor(Math.random() * (max + 1));
}

export function parseInteger(string) {
    return parseInt(string, 10);
}

// A naive but generic way of generating random values different from an
// existing value.
export function untilDifferent(oldValue, generator) {
    let newValue = oldValue;
    while ( R.equals(oldValue, newValue) ) {
        newValue = generator();
    }
    return newValue;
}

export function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.substring(1);
}

export function toArray(object) {
    return Object.keys(object).map(key => {
        return object[key];
    });
}

export function even(number) {
    return number % 2 === 0;
}

export function odd(number) {
    return number % 2 === 1;
}

export function shuffle(array) {
    const source = array.slice();
    const result = [];
    while ( source.length > 0 ) {
        const index = randomInteger(source.length - 1);
        result.push(source[index]);
        source.splice(index, 1);
    }
    return result;
}

export function startsWith(string, substring) {
    if ( string.startsWith ) {
        return string.startsWith(substring);
    }
    else {
        return string.indexOf(substring) === 0;
    }
}

export function contains(string, substring) {
    if ( string.includes ) {
        return string.includes(substring);
    }
    else {
        return string.indexOf(substring) !== -1;
    }
}
