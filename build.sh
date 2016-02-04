shopt -s globstar

function compile {
    local SOURCE=${1}
    
    # Compile SCSS to CSS
    echo "Compile: $SOURCE/css"
    sass --update $SOURCE/css
    
    # Compile ES6 to JS
    for ES6 in $SOURCE/**/*.es6
    do
        JS="${ES6%.*}.js"
        if [ "$ES6" -nt "$JS" ]
        then
            echo "Compile: $SOURCE/$ES6 => $SOURCE/$JS"
            babel --source-maps inline "$ES6" > "$JS"
        fi
    done
    
    # Compile JS to single file
    echo "Compile: $SOURCE/source/main.js => $SOURCE/bundle.js"
    NODE_PATH="$SOURCE/libraries:$SOURCE/source" browserify "$SOURCE/source/main.js" -o "$SOURCE/bundle.js" --debug
    
    echo "Compile: $SOURCE/tests/main.js => $SOURCE/tests/bundle.js"
    NODE_PATH="$SOURCE/libraries:$SOURCE/source" browserify "$SOURCE/tests/main.js" -o "$SOURCE/tests/bundle.js" --debug
}

if [ "$#" -ne 1 ]
then
    echo "Usage: build.sh <source>"
    exit
fi

SOURCE="$1"

compile $SOURCE

while inotifywait --exclude "\.git" --recursive --event=create,modify,delete,move $SOURCE
do
    compile $SOURCE
done
