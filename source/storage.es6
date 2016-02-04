export function open(name, create) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onerror = event => {
            reject(request.error);
        };
        request.onupgradeneeded = event => {
            create(request.result);
        };
        request.onsuccess = event => {
            resolve(request.result);
        };
    });
}

export function read(db, store, key) {
    if ( key ) {
        return readOne(db, store, key);
    }
    else {
        return readAll(db, store);
    }
}

function readAll(db, store) {
    return new Promise((resolve, reject) => {
        const request = db.transaction([store], 'readonly')
            .objectStore(store)
            .openCursor();
        const values = {};
        request.onsuccess = event => {
            const cursor = request.result;
            if ( cursor ) {
                values[cursor.key] = cursor.value;
                cursor.continue();
            }
            else {
                resolve(values);
            }
        };
        request.onerror = event => {
            reject(request.error);
        };
    });
}

function readOne(db, store, key) {
    return new Promise((resolve, reject) => {
        const request = db.transaction([store], 'readonly')
            .objectStore(store)
            .get(key);
        request.onsuccess = event => {
            resolve(request.result);
        };
        request.onerror = event => {
            reject(request.error);
        };
    });
}

export function write(db, store, key, value) {
    return new Promise((resolve, reject) => {
        const request = db.transaction([store], 'readwrite')
            .objectStore(store)
            .put(value, key);
        request.onsuccess = event => {
            resolve();
        };
        request.onerror = event => {
            reject(request.error);
        };
    });
}

export function remove(db, store, key) {
    return new Promise((resolve, reject) => {
        const request = db.transaction([store], 'readwrite')
            .objectStore(store)
            .delete(key);
        request.onsuccess = event => {
            resolve();
        };
        request.onerror = event => {
            reject(request.error);
        };
    });
}
