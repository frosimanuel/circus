# 🎪 The Circus - Clown Finance Application Hub

We created the circus with just one app for starters, which is the no-loose-raffle, a mad kind of pool where every user stakes an amount of tickets, which will be staked for a pre-defined amount of time and afterwards, one of the participants will be randomly selected using VRF (A Verifiable Random Function).

That lucky one will get all the **fees* from the pool, and all the ~~losers~~ other participants will be able to claim back his initial stake minus a small fee.

## And why it's a hub?

This is built as an open framework where we will be adding new games but it has an open SDK where games can be added after a verification process, to build this circus up and create a complete kermesse in the process.

## Architecture 

```
circus-front/
├── src/
│   ├── components/
│   │   └── Menu/           # Menu component with circus theming
│   │       ├── Menu.tsx
│   │       └── Menu.css
│   ├── styles/
│   │   ├── theme.ts        # Design system configuration
│   │   └── global.css      # Global styles and resets
│   ├── App.tsx             # Main application component
│   ├── App.css
│   ├── main.tsx            # Application entry point
│   └── vite-env.d.ts
├── public/
│   └── circus-tent.svg     # Custom favicon
├── index.html
├── vite.config.ts          # Vite configuration with path aliases
├── tsconfig.json           # TypeScript strict configuration
└── package.json
```

## Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
Opens at `http://localhost:5173`

### Build
```bash
npm run build
```
Outputs optimized production build to `dist/`

### Preview Production Build
```bash
npm run preview
```

### Type Checking
```bash
npx tsc --noEmit
```

## Configuration

### Path Aliases
Configured in `tsconfig.json` and `vite.config.ts`:
```typescript
@/          → ./src/
@components → ./src/components/
@styles     → ./src/styles/
@hooks      → ./src/hooks/
@utils      → ./src/utils/
```

### TypeScript
Strict mode enabled with:
- `noUnusedLocals`
- `noUnusedParameters`
- `noFallthroughCasesInSwitch`

## Performance

- **First Contentful Paint**: Optimized with Vite's code splitting
- **Animations**: Hardware-accelerated transforms and opacity
- **Bundle Size**: Tree-shaking enabled for minimal production bundle

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Code Quality

- **Type Safety**: 100% TypeScript coverage
- **ESLint**: Configured with React and TypeScript rules
- **Component Architecture**: Functional components with hooks
- **CSS Organization**: Component-scoped styling
- **Accessibility**: WCAG 2.1 AA compliant

## Future Roadmap

- [ ] Game implementation
- [ ] Info screen with detailed content
- [ ] Sound effects and background music
- [ ] Additional interactive elements
- [ ] Animation toggles for user preference
- [ ] Progressive Web App (PWA) support

---

**Built with anxiety. Designed with madness. Engineered to perfection.**
