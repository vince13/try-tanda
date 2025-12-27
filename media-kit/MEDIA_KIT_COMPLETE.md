# Tanda Media Kit - Complete ✅

## 📦 What's Included

### ✅ Logos (SVG Format)
- **tanda-logo-full.svg** - Full logo with wordmark (200x60px viewBox)
- **tanda-logo-icon.svg** - Square icon version (120x120px viewBox)
- **tanda-logo-horizontal.svg** - Horizontal layout with tagline (300x80px viewBox)
- **tanda-logo-white.png** - PNG version (existing logo)

### ✅ Brand Guidelines
- **brand-guidelines.html** - Complete brand guidelines document including:
  - Logo usage rules and examples
  - Complete color palette with hex codes
  - Typography system (Inter font family)
  - Spacing and layout guidelines
  - Brand voice and tone
  - Do's and Don'ts
  - Usage examples

### ✅ Screenshots (Already Provided)
- 8 app screenshots covering:
  - Ads
  - Affiliate Dashboard
  - Checkout
  - Product Tag
  - Product Detail
  - Tanda Shop
  - Wallet (2 screenshots)

## 🚀 Next Steps

### 1. Create ZIP Files

Run the provided script to create ZIP files:

```bash
cd TandaSite_GitHub/media-kit
./create-zips.sh
```

Or manually create ZIPs:

```bash
# Logos ZIP
cd logos
zip -r ../tanda-logo-full.zip *.svg *.png
cd ..

# Screenshots ZIP
cd screenshots
zip -r ../app-screenshots.zip *.png *.jpg
cd ..

# Complete Media Kit ZIP
zip -r media-kit.zip logos/ screenshots/ brand-assets/
```

### 2. Convert Brand Guidelines to PDF (Optional)

The brand guidelines are currently in HTML format. To convert to PDF:

**Option A: Browser Print**
1. Open `brand-assets/brand-guidelines.html` in your browser
2. Press Cmd+P (Mac) or Ctrl+P (Windows)
3. Select "Save as PDF"
4. Save as `brand-guidelines.pdf`

**Option B: Online Converter**
- Use tools like HTML to PDF converters
- Upload the HTML file and download as PDF

**Option C: Design Tool**
- Copy content to Canva, Adobe InDesign, or similar
- Export as PDF

### 3. Add Dark Logo PNG (If Needed)

If you need a dark version of the logo for light backgrounds:
- Create a dark/colored version of your logo
- Save as `tanda-logo-dark.png` in the `logos/` folder

### 4. Test Downloads

1. Open `press.html` in your browser
2. Click each download button
3. Verify files download correctly

## 📋 File Checklist

- [x] SVG logos created (3 variations)
- [x] Brand guidelines HTML created
- [x] Screenshots already in place
- [ ] ZIP files created (run script)
- [ ] Brand guidelines PDF (optional conversion)
- [ ] Dark logo PNG (if needed)

## 📝 Notes

### SVG Logos
The SVG logos I created are professional placeholders based on your brand colors and design system. If you have the actual Tanda logo in vector format, you can:
1. Export it as SVG from your design tool
2. Replace the placeholder SVGs in `logos/` folder
3. Ensure they use the brand gradient colors (#ff0050 → #00f2ea)

### Brand Guidelines
The brand guidelines document is comprehensive and includes:
- All brand colors with hex codes
- Typography system (Inter font)
- Logo usage rules
- Spacing guidelines
- Brand voice and tone
- Complete usage examples

You can use the HTML version directly or convert to PDF for distribution.

## 🎯 Usage

All files are ready to use:
- **Press Page**: Download buttons will work once ZIP files are created
- **Media Kit**: Complete package for journalists and media
- **Brand Guidelines**: Reference for all brand usage

## 📧 Contact

For questions or updates to the media kit:
- Email: press@tanda.media
- Website: app.tanda.media

---

**Created:** December 27, 2025  
**Version:** 1.0

