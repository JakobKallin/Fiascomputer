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

export function contains(value, subvalue) {
    if ( value.includes ) {
        return value.includes(subvalue);
    }
    else {
        return value.indexOf(subvalue) !== -1;
    }
}

export function logCallbacks(names) {
    const callbacks = {};
    names.forEach(name => {
        callbacks[name] = function() {
            console.log(name + ': ' + [].slice.call(arguments).join(', '));
        };
    });
    return callbacks;
}

export function withParams() {
    var args = [].slice.call(arguments);
    var extra = args.slice(0, args.length - 1);
    var callbacks = args[args.length - 1];
    return R.mapObjIndexed(f => function() {
        var original = [].slice.call(arguments);
        return f.apply(undefined, original.concat(extra.map(e => e())));
    }, callbacks);
}
