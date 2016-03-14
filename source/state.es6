import R from 'ramda';

export function read() {
    try {
        const savedState = JSON.parse(localStorage.state);
        if ( typeof savedState === 'object' ) {
            return R.merge(emptyState(), savedState);
        }
        else {
            return emptyState();
        }
    }
    catch(error) {
        return emptyState();
    }
}

export function write(values) {
    const newState = R.merge(read(), values);
    localStorage.state = JSON.stringify(newState);
}

function emptyState() {
    return {
        sessions: {},
        playset: null,
        theme: 'red'
    };
}
