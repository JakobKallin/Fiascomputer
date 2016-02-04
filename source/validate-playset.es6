import R from 'ramda';

export default function validatePlayset(playset) {
    const errors = [];
    
    require(typeof(playset.title) === 'string' && playset.title !== '', 'No title');
    require(typeof(playset.subtitle) === 'string' && playset.subtitle !== '', 'No subtitle');
    Object.keys(playset.tables).forEach(key => {
        const t = playset.tables[key];
        require(typeof(t.title) === 'string' && t.title !== '', 'No title');
        require(t.categories.length === 6, 'Only ' + t.categories.length + ' categories');
        t.categories.forEach((c, ci) => {
            require(typeof(c.name) === 'string' && c.name !== '', 'Category ' + (ci + 1) + ' is empty');
            require(c.elements.length === 6, 'Only ' + c.elements.length + ' elements in category ' + (ci + 1));
            c.elements.forEach((e, ei) => {
                require(typeof(e) === 'string' && e !== '', 'Element ' + (ei + 1) + ' in category ' + (ci + 1) + ' is empty');
            });
        });
    });
    
    return errors;
    
    function require(assertion, errorMessage) {
        if ( !assertion ) {
            errors.push(errorMessage);
        }
    }
}

export function logPlayset(playset) {
    Object.keys(playset.tables).forEach(key => {
        const t = playset.tables[key];
        console.group(key);
        console.log(t.categories.map((c, ci) => {
            return (
                (ci + 1) + '. ' + c.name + '\n' +
                '-----\n' +
                c.elements.map((e, ei) => (ei + 1) + '. ' + e).join('\n')
            );
        }).join('\n\n'));
        console.groupEnd();
    });
}
