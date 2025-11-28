# VoxBox Frontend

Modern React frontend for the VoxBox AI-powered content creation platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment setup**
   Create `.env` file in the `voxbox-frontend` directory:
   ```env
   VITE_API_URL=http://localhost:3000/api/v1
   ```
   
   Or run the setup script:
   - **Windows**: `powershell -ExecutionPolicy Bypass -File setup-env.ps1`
   - **Linux/Mac**: `bash setup-env.sh`
   
   See `ENV_SETUP.md` for more details.

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, Card, etc.)
│   ├── Navbar.tsx      # Navigation component
│   ├── Hero.tsx        # Landing page hero section
│   ├── Features.tsx    # Features showcase
│   ├── About.tsx       # About section
│   ├── CTA.tsx         # Call-to-action section
│   └── Footer.tsx      # Footer component
├── pages/              # Page components
│   ├── Index.tsx       # Landing page
│   ├── Login.tsx       # Login page
│   ├── Register.tsx # Registration page
│   ├── Pricing.tsx       # Pricing with Stripe integration
│   ├── Dashboard.tsx   # User dashboard
│   ├── ThankYou.tsx    # Payment success page
│   ├── Cancel.tsx      # Payment cancellation page
│   ├── Contact.tsx     # Contact page
│   └── Features.tsx    # Features page
├── lib/                # Utility functions
│   ├── utils.ts        # General utilities
│   └── payment.ts      # Stripe payment integration
├── assets/             # Static assets
└── hooks/              # Custom React hooks
```

## 🎨 Design System

### Colors
- **Primary**: VoxBox Pink (#FF206E)
- **Secondary**: VoxBox Blue (#41EAD4) 
- **Accent**: VoxBox Green (#9EF01A)
- **Gold**: VoxBox Gold (#C6B79B)
- **Dark**: VoxBox Dark (#0C0F0A)

### Typography
- **Headings**: Poppins (font-heading)
- **Body**: Open Sans (font-sans)

### Components
Built with Radix UI primitives for accessibility:
- Button
- Card
- Input
- Label
- Select
- Badge

## 🛠️ Technology Stack

- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **React Router**: Client-side routing
- **Lucide React**: Icon library

## 📱 Pages & Routes

### Public Routes
- `/` - Landing page
- `/features` - Features overview
- `/pricing` - Subscription plans
- `/contact` - Contact information
- `/login` - User login
- `/register` - User registration

### Protected Routes
- `/dashboard` - User dashboard
- `/thank-you` - Payment success
- `/cancel` - Payment cancellation

## 💳 Payment Integration

### Stripe Checkout Flow
1. User selects plan on pricing page
2. `redirectToCheckout()` function called
3. API creates Stripe checkout session
4. User redirected to Stripe
5. Success/cancel redirects handled

### Payment Service
```typescript
import { redirectToCheckout } from '@/lib/payment';

// Redirect to Stripe checkout
await redirectToCheckout('pro', workspaceId);
```

## 🎯 Key Features

### Landing Page
- Hero section with animated background
- Features showcase
- About section with benefits
- Call-to-action section
- Responsive design

### Authentication
- Login/Register forms
- Form validation
- Success/error handling
- Workspace creation

### Pricing
- Two subscription plans
- Stripe integration
- Loading states
- Error handling

### Dashboard
- Quick actions
- Recent activity
- Usage statistics
- Team management

## 🚀 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style
- ESLint configuration
- TypeScript strict mode
- Consistent formatting
- Component organization

## 📦 Dependencies

### Core Dependencies
- React 18.3.1
- React Router 6.30.1
- TypeScript 5.8.3
- Tailwind CSS 3.4.17

### UI Dependencies
- Radix UI components
- Lucide React icons
- Class Variance Authority
- Tailwind Merge

### Development Dependencies
- Vite 5.4.19
- ESLint 9.32.0
- TypeScript ESLint 8.38.0

## ⚠️ Recent Fixes (October 2025)

### Fixed Issues
1. ✅ **Authentication Errors**: Fixed "Invalid response: missing access token" by updating frontend to handle backend's wrapped response format
2. ✅ **Payment Flow**: Fixed "Invalid response from checkout session API" by unwrapping API responses
3. ✅ **Button Text**: Changed "Start Free Trial" to "Pay Now" on pricing page
4. ✅ **Environment Config**: Added `.env` file with proper API URL configuration

### What Changed
- Backend wraps responses in a `data` object via `TransformInterceptor`
- Frontend now unwraps the `data` object: `const authData = result.data || result`
- Updated all API service methods in `src/lib/auth.ts` and `src/lib/payment.ts`
- Added detailed logging for debugging

See `FIXES_APPLIED.md` for complete details.

## 🔧 Configuration

### Tailwind Config
Custom design system with:
- VoxBox brand colors
- Custom gradients
- Animation keyframes
- Responsive breakpoints

### Vite Config
- React plugin
- TypeScript support
- Path aliases (@/ for src/)
- Development server

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints: sm, md, lg, xl, 2xl
- Flexible grid layouts
- Responsive typography
- Touch-friendly interactions

## 🎨 Styling

### CSS Architecture
- Tailwind utility classes
- Custom CSS variables
- Component-scoped styles
- Dark mode support

### Animation
- Fade-in animations
- Hover effects
- Loading states
- Smooth transitions

## 🧪 Testing

### Component Testing
```bash
npm run test
```

### E2E Testing
```bash
npm run test:e2e
```

## 🚀 Deployment

### Build Process
1. TypeScript compilation
2. Vite bundling
3. Asset optimization
4. Static file generation

### Production Build
```bash
npm run build
```

### Deployment Options
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

## 🔒 Security

- Environment variable protection
- API URL configuration
- Secure payment handling
- XSS protection

## 📈 Performance

- Code splitting
- Lazy loading
- Image optimization
- Bundle analysis
- Lighthouse optimization

## 🤝 Contributing

1. Follow code style guidelines
2. Write TypeScript types
3. Use semantic commit messages
4. Test your changes
5. Update documentation

## 📄 License

Proprietary software. All rights reserved.

---

**VoxBox Frontend** - Modern, accessible, and performant React application.