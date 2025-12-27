# Tanda Media Kit

This folder contains all media assets for press and media use.

## 📁 Folder Structure

```
media-kit/
├── logos/              # Company logos in various formats
├── screenshots/        # App and platform screenshots
├── brand-assets/       # Brand guidelines and color palettes
└── media-kit.zip      # Complete media kit (all assets in one file)
```

## ✅ Current Status

- ✅ Folder structure created
- ✅ Logo placeholder added (`tanda-logo-white.png`)
- ⏳ Screenshots needed
- ⏳ Brand guidelines PDF needed
- ⏳ Complete ZIP file needed

## 📝 What to Add

### 1. Logos (`logos/` folder)
Add these logo files:
- `tanda-logo-white.png` - White logo on transparent (already added as placeholder)
- `tanda-logo-dark.png` - Dark/colored logo on transparent
- `tanda-logo-full.svg` - Vector logo (scalable)
- `tanda-logo-icon.png` - Square icon (512x512px minimum)
- `tanda-logo-horizontal.png` - Horizontal logo with text

**Then create:** `tanda-logo-full.zip` containing all logo files

### 2. Screenshots (`screenshots/` folder)
Add app screenshots:
- `app-home-screen.png`
- `app-video-feed.png`
- `app-product-tag.png`
- `app-checkout.png`
- `app-profile.png`

**Then create:** `app-screenshots.zip` containing all screenshots

### 3. Brand Assets (`brand-assets/` folder)
Create:
- `brand-guidelines.pdf` - Complete brand guide with:
  - Color palette (Primary: #ff0050, Accent: #00f2ea)
  - Typography (Inter font family)
  - Logo usage rules
  - Spacing guidelines

### 4. Complete Media Kit ZIP
Create `media-kit.zip` in the root of this folder containing:
- All logos
- All screenshots
- All brand assets

## 🚀 Quick Setup Commands

### Create ZIP files (Mac/Linux):
```bash
# Logos ZIP
cd logos
zip -r ../tanda-logo-full.zip .
cd ..

# Screenshots ZIP
cd screenshots
zip -r ../app-screenshots.zip .
cd ..

# Complete media kit ZIP
zip -r media-kit.zip logos/ screenshots/ brand-assets/
```

### Create ZIP files (Windows PowerShell):
```powershell
# Logos ZIP
Compress-Archive -Path logos\* -DestinationPath tanda-logo-full.zip

# Screenshots ZIP
Compress-Archive -Path screenshots\* -DestinationPath app-screenshots.zip

# Complete media kit ZIP
Compress-Archive -Path logos, screenshots, brand-assets -DestinationPath media-kit.zip
```

## 📧 Need Help?

Contact: press@tanda.media

