<?php

$uri = $_SERVER['REQUEST_URI'];
if ( preg_match('#^/join/#', $uri) ) {
    print file_get_contents($_SERVER['DOCUMENT_ROOT'] . '/join/index.html');
}
else {
    print file_get_contents($_SERVER['DOCUMENT_ROOT'] . '/index.html');
}
