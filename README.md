# free-text-to-speech

A modern web application built with **Next.js 15**, **React 19**, **TailwindCSS**, and **shadcn/ui**. This project serves as a starter template for building scalable, component-driven applications with TypeScript and a clean developer experience.

---

## 🚀 Features
- ⚡ Next.js 15 (App Router)
- 🎨 TailwindCSS for styling
- 🧩 shadcn/ui components
- 🌓 Dark mode support via `next-themes`
- 📊 Recharts for data visualization
- 🧰 React Hook Form + Zod for form validation
- 📦 Optimized project structure with TypeScript

---

## 📦 Tech Stack
- **Framework:** Next.js 15
- **Language:** TypeScript
- **UI Library:** shadcn/ui, Radix UI, Lucide Icons
- **Styling:** TailwindCSS, tailwind-merge
- **State & Forms:** React Hook Form, Zod
- **Charts:** Recharts
- **Utilities:** date-fns, clsx, class-variance-authority

---

## 🛠️ Installation & Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/visernic/free-text-to-speech.git
cd free-text-to-speech
pnpm install

free-text-to-speech/
├── app/               # Next.js app router pages & layouts
│   ├── layout.tsx     # Root layout
│   ├── page.tsx       # Home page
│   └── globals.css    # Global styles
├── components/        # Reusable UI components
├── public/            # Static assets
├── tailwind.config.ts # TailwindCSS config
├── tsconfig.json      # TypeScript config
├── package.json       # Project metadata & scripts
└── pnpm-lock.yaml     # Dependency lockfile
