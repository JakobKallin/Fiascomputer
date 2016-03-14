import * as R from 'ramda';
import * as dom from 'dom';

export function host(id, initial, signal) {
    if (id) {
        return connect(id, signal, initial).catch(() => {
            console.log('Error using existing file ' + id + ', creating new file');
            return create().then(newId => connect(newId, signal, initial));
        });
    }
    else {
        return create().then(newId => connect(newId, signal, initial));
    }
}

export function join(id, signal) {
    return connect(id, signal);
}

function connect(id, signal, initial) {
    return new Promise((resolve, reject) => {
        gapi.drive.realtime.load(id, startEditing, createModel, error => {
            // If the provided file does not exist (for example if its ID was
            // saved in the app but the file itself was removed from Google
            // Drive), simply create a new one.
            if ( error.type === 'not_found' ) {
                host(null, initial, signal).then(resolve).catch(reject);
            }
            else {
                reject(error);
            }
        });
        
        // For some reason using a normal variable does not seem to work
        // properly when accessed below; it's set to false when it should be
        // true. Since there might be an issue of multiple instances of this
        // function being invoked, we use a global variable to be sure.
        window.googleRealtimeActive = false;
        const changeUnlessRecursive = function() {
            window.googleRealtimeActive = true;
            signal.change.apply(undefined, arguments);
            window.googleRealtimeActive = false;
        };
        
        function startEditing(doc) {
            const root = doc.getModel().getRoot();
            const setup = root.get('setup');
            const playset = root.get('playset');
            
            doc.addEventListener(gapi.drive.realtime.EventType.COLLABORATOR_JOINED, event => {
                signal.playerJoined(event.collaborator)
            });
            doc.addEventListener(gapi.drive.realtime.EventType.COLLABORATOR_LEFT, event => {
                signal.playerLeft(event.collaborator);
            });
            
            doc.getCollaborators().forEach(signal.playerJoined);
            
            try {
                enableList(setup, 'players', initial ? initial.players : undefined, 'player');
                enableList(setup, 'relationships', initial ? initial.pairs.map(p => p.relationship) : undefined, 'relationship');
                enableList(setup, 'details', initial ? initial.pairs.map(p => p.detail) : undefined, 'detail');
                enablePrimitive(setup, 'activePlayers', initial ? initial.activePlayers : undefined);
                enableString(playset, 'title', initial ? initial.playset.title : undefined);
                enableString(playset, 'subtitle', initial ? initial.playset.subtitle : undefined);
                playset.get('tables').keys().forEach(tableName => {
                    const table = playset.get('tables').get(tableName);
                    
                    table.get('categories').addEventListener(gapi.drive.realtime.EventType.VALUES_SET, onCategoryChange);
                    function onCategoryChange(event) {
                        if ( !event.isLocal ) {
                            event.newValues.forEach((v, i) => {
                                changeUnlessRecursive('category', tableName, i + event.index, v);
                            });
                        }
                    }
                    if (initial) {
                        table.get('categories').replaceRange(0, initial.playset.tables[tableName].categories);
                    }
                    onCategoryChange({ newValues: table.get('categories').asArray(), index: 0 });
                    
                    table.get('elements').asArray().forEach((es, c) => {
                        es.addEventListener(gapi.drive.realtime.EventType.VALUES_SET, onElementChange);
                        function onElementChange(event) {
                            if ( !event.isLocal ) {
                                event.newValues.forEach((v, i) => {
                                    changeUnlessRecursive('element', tableName, c, i + event.index, v);
                                });
                            }
                        }
                        if (initial) {
                            es.replaceRange(0, initial.playset.tables[tableName].elements[c]);
                        }
                        onElementChange({ newValues: es.asArray(), index: 0 });
                    });
                });
            }
            catch(error) {
                reject(error);
                throw error;
            }
            
            resolve({
                id: id,
                change: function(key) {
                    // We don't want to trigger infinite recursion if this call
                    // was triggered by something that was in turn triggered by
                    // a realtime API change event. Right now're only using a
                    // simple boolean to achieve this, but we might need to
                    // expand it in the future to something that keeps track of
                    // the specific value changed, in case there are legitimate
                    // reasons for triggering a change to one property from a
                    // change to another property.
                    if ( window.googleRealtimeActive ) {
                        return;
                    }
                    
                    var args = [].slice.call(arguments, 1);
                    if ( key === 'player' ) {
                        setup.get('players').set(args[0], args[1]);
                    }
                    else if ( key === 'relationship') {
                        setup.get('relationships').set(args[0], args[1]);
                    }
                    else if ( key === 'detail') {
                        setup.get('details').set(args[0], args[1]);
                    }
                    else if ( key === 'activePlayers' ) {
                        setup.set('activePlayers', args[0]);
                    }
                    else if ( key === 'title' ) {
                        playset.get('title').setText(args[0]);
                    }
                    else if ( key === 'subtitle' ) {
                        playset.get('subtitle').setText(args[0]);
                    }
                    else if ( key === 'category' ) {
                        playset.get('tables').get(args[0]).get('categories').set(args[1], args[2]);
                    }
                    else if ( key === 'element' ) {
                        playset.get('tables').get(args[0]).get('elements').get(args[1]).set(args[2], args[3]);
                    }
                }
            });
            
            function enableString(map, name, initial) {
                requireMapProperty(map, name);
                
                const string = map.get(name);
                string.addEventListener(gapi.drive.realtime.EventType.TEXT_INSERTED, onChange);
                string.addEventListener(gapi.drive.realtime.EventType.TEXT_DELETED, onChange);
                function onChange(event) {
                    if ( !event.isLocal ) {
                        changeUnlessRecursive(name, string.getText());
                    }
                }
                if (initial !== undefined) {
                    string.setText(initial);
                }
                onChange({});
            }
            
            function enableList(map, name, initial, changeName) {
                requireMapProperty(map, name);
                
                const list = map.get(name);
                list.addEventListener(gapi.drive.realtime.EventType.VALUES_SET, onChange);
                function onChange(event) {
                    if ( !event.isLocal ) {
                        event.newValues.forEach((v, i) => {
                            changeUnlessRecursive(changeName, i + event.index, v);
                        });
                    }
                }
                if (initial) {
                    list.replaceRange(0, initial);
                }
                onChange({ newValues: list.asArray(), index: 0 });
            }
            
            function enablePrimitive(map, name, initial) {
                requireMapProperty(map, name);
                
                map.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, onChange);
                function onChange(event) {
                    if ( !event.isLocal ) {
                        changeUnlessRecursive(name, event.newValue);
                    }
                }
                if (initial !== undefined) {
                    map.set(name, initial);
                }
                onChange({ newValue: map.get(name) });
            }
            
            function requireMapProperty(map, name) {
                if ( !map.has(name) ) {
                    const error = new Error('Required property not in model: ' + name);
                    error.name = 'InvalidModel';
                    throw error;
                }
            }
        }
        
        function createModel(model) {
            try {
                model.getRoot().set('setup', model.createMap({
                    players: model.createList(initial.players),
                    relationships: model.createList(initial.pairs.map(p => p.relationship)),
                    details: model.createList(initial.pairs.map(p => p.detail)),
                    activePlayers: initial.activePlayers
                }));
                model.getRoot().set('playset', model.createMap({
                    title: model.createString(initial.playset.title),
                    subtitle: model.createString(initial.playset.subtitle),
                    tables: model.createMap(R.mapObjIndexed((table, name) => { return model.createMap({
                        categories: model.createList(table.categories),
                        elements: model.createList(table.elements.map(es => model.createList(es)))
                    })}, initial.playset.tables))
                }));
            }
            catch(error) {
                reject(error);
                throw error;
            }
        }
    });
}

export function load() {
    const scripts = [
        'https://apis.google.com/js/api.js',
        'https://www.gstatic.com/realtime/realtime-client-utils.js'
    ];
    return Promise.all(scripts.map(dom.loadScript))
    .then(() => {
        return new Promise((resolve, reject) => {
            gapi.load('auth:client,drive-realtime,drive-share', () => {
                gapi.client.load('drive', 'v3').then(() => {
                    resolve();
                }, reject);
            }, reject);
        });
    });
}

export function auth(popup) {
    if (popup === undefined) popup = false;
    
    return new Promise((resolve, reject) => {
        try {
            const u = createUtils();
            u.authorize(function(response) {
                if (response.error) {
                    reject(response.error);
                } else {
                    resolve();
                }
            }, popup);
        }
        catch(error) {
            reject(error);
        }
    });
}

function create() {
    return new Promise((resolve, reject) => {
        gapi.client.drive.files.create({
            resource: {
                name: 'Fiascomputer ' + new Date().toLocaleString(),
                mimeType: 'application/vnd.google-apps.drive-sdk'
            }
        })
        .execute(file => {
            if ( file.error ) {
                reject(file.error);
            }
            else {
                gapi.client.drive.permissions.create({
                    fileId: file.id,
                    resource: {
                        type: 'anyone',
                        role: 'writer'
                    }
                })
                .execute(permission => {
                    if (permission.error) {
                        reject(permission.error);
                    }
                    else {
                        resolve(file.id);
                    }
                });
            }
        });
    });
}

export function loadHost(session) {
    return new Promise((resolve, reject) => {
        return load().then(() => {
            gapi.client.drive.files.get({
                fileId: session
            })
            .execute(file => {
                if (file.error) {
                    reject(file.error);
                }
                else {
                    resolve(file.sharingUser);
                }
            })
        });
    });
}

function createUtils() {
    return new utils.RealtimeUtils({
        clientId: '269381917086-j06c9atiqeqn2gafsmrksnsr9l0uulr9.apps.googleusercontent.com'
    });
}
