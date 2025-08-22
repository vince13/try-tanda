# Tanda - Video Commerce Platform

A modern, responsive website for Tanda, Africa's next-generation video commerce platform. Built with HTML5, CSS3, and vanilla JavaScript, optimized for GitHub Pages deployment.

## 🚀 Features

- **Modern Design**: Clean, professional interface with gradient accents
- **Mobile-First**: Fully responsive design optimized for all devices
- **Interactive Elements**: Smooth animations, hover effects, and smooth scrolling
- **Waitlist Integration**: Google Forms integration for collecting user registrations
- **Performance Optimized**: Fast loading with minimal dependencies
- **SEO Ready**: Proper meta tags and semantic HTML structure

## 📱 Sections

1. **Hero Section**: Compelling introduction with call-to-action buttons
2. **Waitlist Form**: Multi-field registration form with Google Forms integration
3. **Features**: Six key features with icons and descriptions
4. **How It Works**: Step-by-step process explanation
5. **Screenshots**: App mockups with descriptions
6. **Statistics**: Key market data and metrics
7. **Footer**: Contact information and social links

## 🛠️ Setup Instructions

### 1. Google Forms Integration

To connect the waitlist form to Google Forms:

1. **Create a Google Form**:
   - Go to [Google Forms](https://forms.google.com)
   - Create a new form with the following fields:
     - First Name (Short answer)
     - Last Name (Short answer)
     - Email Address (Email)
     - Phone Number (Phone number)
     - Country (Multiple choice)
     - Interest (Multiple choice)

2. **Get Form Details**:
   - Click "Send" and copy the form URL
   - Extract the form ID from the URL (between `/d/e/` and `/formResponse`)
   - Get the entry IDs for each field by inspecting the form

3. **Update the HTML**:
   - Replace `YOUR_ACTUAL_FORM_ID` in the form action
   - Update the `name` attributes with your actual entry IDs

### 2. GitHub Pages Deployment

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial Tanda website commit"
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository Settings
   - Navigate to Pages section
   - Select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Click Save

3. **Custom Domain** (Optional):
   - Add your custom domain in the Pages settings
   - Update DNS records as instructed

### 3. Customization

#### Colors and Branding
- Update CSS variables in `:root` section
- Modify gradient colors and accent colors
- Replace placeholder images with actual screenshots

#### Content Updates
- Update company information in the footer
- Replace placeholder text with actual content
- Add real social media links

#### Form Fields
- Modify form fields based on your needs
- Add/remove countries in the dropdown
- Customize interest categories

## 📁 File Structure

```
TandaSite_GitHub/
├── index.html          # Main website file
├── README.md           # This file
└── .gitignore          # Git ignore file (optional)
```

## 🌐 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📱 Mobile Optimization

- Responsive grid layouts
- Touch-friendly buttons and forms
- Optimized typography for small screens
- Mobile-first navigation

## ⚡ Performance Features

- Minimal external dependencies
- Optimized CSS with CSS variables
- Efficient JavaScript with event delegation
- Smooth animations using CSS transforms

## 🔧 Customization Guide

### Changing Colors
```css
:root {
  --primary-gradient: linear-gradient(135deg, #ff0050, #00f2ea);
  --accent-color: #00f2ea;
  --bg-primary: #000000;
  --bg-secondary: #111111;
}
```

### Adding New Sections
1. Create new HTML section
2. Add corresponding CSS styles
3. Update navigation links
4. Add smooth scrolling behavior

### Modifying Animations
```css
.fade-in-up {
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## 📊 Analytics Integration

To add Google Analytics:

1. Get your Google Analytics tracking ID
2. Add this script before `</head>`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_TRACKING_ID');
</script>
```

## 🚀 Future Enhancements

- [ ] Blog section for content marketing
- [ ] Investor relations page
- [ ] Press kit and media resources
- [ ] Multi-language support
- [ ] Dark/light theme toggle
- [ ] Newsletter signup integration
- [ ] Social media feed integration

## 📞 Support

For technical support or customization requests:
- Email: hello@tanda.africa
- GitHub Issues: [Create an issue](https://github.com/yourusername/TandaSite_GitHub/issues)

## 📄 License

This project is proprietary to Tanda. All rights reserved.

---

**Built with ❤️ for Africa's digital commerce future**
