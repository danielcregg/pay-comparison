# ATU Pay Comparison

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)

An interactive tool that visualises how ATU's monthly and fortnightly pay systems deliver the same annual salary. Built with React and deployable to GitHub Pages.

## Overview

ATU transitioned from monthly to fortnightly pay in 2026. This application helps staff understand that both payment schedules result in the same total compensation. Users can select their pay scale and increment point, then explore animated charts, side-by-side timelines, and full pay-date schedules across any year from 2026 to 2048. The tool also explains the 26- vs 27-payday year phenomenon.

## Features

- Interactive pay scale and increment point selector (data scraped from TUI.ie)
- Animated cumulative pay chart with click-and-drag date exploration
- Side-by-side monthly vs fortnightly timeline bars
- Live comparison cards showing received totals at any point in the year
- Full pay-date schedule view with running totals
- 26 vs 27 payday year explainer with year-by-year breakdown
- Responsive dark-themed UI with touch support
- Automated pay-scale data fetching from TUI.ie

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm 9+

## Getting Started

### Installation

```bash
git clone https://github.com/danielcregg/pay-comparison.git
cd pay-comparison
npm install
```

### Usage

**Start the development server:**

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

**Update pay-scale data from TUI.ie:**

```bash
npm run update-payscales
```

**Deploy to GitHub Pages:**

```bash
npm run deploy
```

The live site will be available at [https://danielcregg.github.io/pay-comparison/](https://danielcregg.github.io/pay-comparison/).

## Tech Stack

- **Framework:** [React](https://react.dev/) 19
- **Build Tool:** [Vite](https://vitejs.dev/) 7
- **Rendering:** HTML5 Canvas (accumulation chart)
- **Data Source:** [TUI.ie salary scales](https://www.tui.ie/third-level-pay-pensions/third-level-salary-scales-.2167.html)
- **Deployment:** GitHub Pages via `gh-pages`
- **Linting:** ESLint with React hooks and refresh plugins

## License

This project is licensed under the [MIT License](LICENSE).
