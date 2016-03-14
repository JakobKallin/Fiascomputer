import R from 'ramda';
import { contains } from 'utils';

export function handle(location, routes, handlers) {
    const path = readPath(location, routes.depth);
    const query = readQuery(location);
    const req = request(path, query, routes);
    const handler = handlers[req.page] || handlers[routes.default];
    handler(req.params);
    // Check for Piwik first, because it may not have loaded yet
    // (especially for the first page).
    if ( window.Piwik ) {
        Piwik.getAsyncTracker().trackPageView(document.title);
    }
    return req;
}

function readPath(location, depth) {
    return location.pathname.split('/')
        .slice(1)
        .map(decodeURIComponent)
        .filter(s => s !== '')
        .slice(depth);
}

function readQuery(location) {
    const query = {};
    if (location.search.substring(1) !== '') {
        location.search.substring(1)
        .split('&')
        .forEach(s => {
            const kv = s.split('=').map(decodeURIComponent);
            const k = kv[0];
            const v = kv[1];
            query[k] = v;
        });
    }
    return query;
}

export function request(path, query, routes) {
    const match = R.find(r => matchesRoute(path, r), routes.routes);
    if ( !match ) {
        throw new Error('No route matches: /' + path.join('/'));
    }
    
    const name = Object.keys(match)[0];
    const parts = Array.isArray(match[name])
        ? match[name]
        : match[name].path;
    const validQueryParams = Array.isArray(match[name])
        ? []
        : match[name].query;
    const req = {
        page: name,
        params: {}
    };
    
    parts.forEach((v, i) => {
        if ( typeof v === 'string' ) { return; }
        
        const name = Object.keys(v)[0];
        if ( name in req.params ) {
            throw new Error('Duplicate route variable: ' + name);
        }
        const constraint = v[name];
        if ( Array.isArray(constraint) ) {
            req.params[name] = path[i];
        }
        else {
            req.params[name] = constraint(path[i]);
        }
    });
    
    Object.keys(query).forEach(name => {
        if ( contains(validQueryParams, name) ) {
            if ( name in req.params ) {
                throw new Error('Query param has same name as path param: ' + name);
            }
        
            const value = query[name];
            req.params[name] = value;
        }
    });
    
    return req;
}

function matchesRoute(path, route) {
    const name = Object.keys(route)[0];
    const parts = Array.isArray(route[name])
        ? route[name]
        : route[name].path;
    return path.length === parts.length && parts.every((v, i) => matchesRouteVariable(path[i], v));
}

function matchesRouteVariable(value, variable) {
    if ( typeof variable === 'string' ) {
        return value === variable;
    }
    
    const name = Object.keys(variable)[0];
    const constraint = variable[name];
    if ( Array.isArray(constraint) ) {
        return constraint.some(x => value === x);
    }
    else {
        let success = true;
        let converted = null;
        try {
            converted = constraint(value);
        }
        catch(error) {
            success = false;
        }
        if ( Number.isNaN(converted) ) {
            success = false;
        }
        return success;
    }
}
