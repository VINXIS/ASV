# ASV
Alternative Splicing Visualizer (Primarily handling rMATS data)

Needs [node + npm](https://nodejs.org) installed

# Installation
```
npm install
```

# Development
```
npm run dev
```

# Build + run
This project builds as an SSR Node server (for server-side GTF) so there's building and starting required.

```
npm run build
npm run start
```

# Server-side GTFs
The app can optionally fetch transcript models from a server-hosted GTF when an event is selected. Custom GTF files are located in `data/gtf/manifest.json`

Otherwise if you have your own GTF file you can either modify the manifest or just import it directly in the app