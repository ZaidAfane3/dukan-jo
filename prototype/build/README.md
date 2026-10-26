# Dukkan prototype as one HTML file (for usability tests)

Builds the whole app (every page except /saad) into one file that opens by double-clicking, with no server and no internet:
pictures and fonts are packed inside it, and the pages live after the "#" (Dukkan-prototype.html#/dashboard).

Rebuild after changes to the app:

    cd prototype/build
    npm install -D vite@5.4.10 @vitejs/plugin-react@4.3.3 vite-plugin-singlefile@2.0.3   (first time only)
    node fonts.mjs        (first time only: packs the Google fonts into src/fonts.css)
    node assets.mjs       (packs everything in public/ into src/assets.json)
    npx vite build
    copy dist/index.html ..\Dukkan-prototype.html
