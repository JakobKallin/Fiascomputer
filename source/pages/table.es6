import renderTable from '../views/table.js';
import { withParams } from 'utils';

export default function(root, change, readRequest, readState) {
    return renderTable(root, withParams(readRequest, readState, {
        selectCategory: (category, request, state) => {
            const type = request.type;
            const pair = request.pair;
            const item = state.pairs[pair][type];
            
            change(type, pair, {
                table: item.table,
                category: category,
                element: category === item.category ? item.element : null
            });
        },
        selectElement: (category, element, request, state) => {
            const type = request.type;
            const pair = request.pair;
            const item = state.pairs[pair][type];
            
            change(type, pair, {
                table: item.table,
                category: category,
                element: element
            });
        },
        changeCategory: (category, text, request, state) => {
            const type = request.type;
            const pair = request.pair;
            const item = state.pairs[pair][type];
            const table = item.table;
            change('category', table, category, text);
        },
        changeElement: (category, element, text, request, state) => {
            const type = request.type;
            const pair = request.pair;
            const item = state.pairs[pair][type];
            const table = item.table;
            change('element', table, category, element, text);
        },
        changeSubtitle: (text, request, state) => {
            change('subtitle', text);
        }
    }));
}
