# Tanda.media Landing Page - SEO Strategy Guide

## Overview
The landing page (`landing.html`) is designed to be a powerful, SEO-optimized entry point for `tanda.media` that drives traffic to `app.tanda.media`.

## SEO Features Implemented

### 1. **Primary Meta Tags**
- ✅ Optimized title tag: "Tanda - Video Commerce Reimagined for Africa | TikTok-Style Social Commerce Platform"
- ✅ Comprehensive meta description (160 characters)
- ✅ Relevant keywords targeting: video commerce, social commerce, TikTok Africa, creator monetization, etc.
- ✅ Language and geographic targeting (Africa)

### 2. **Open Graph Tags (Facebook/LinkedIn)**
- ✅ Complete OG tags for rich social media previews
- ✅ Optimized image dimensions (1200x630)
- ✅ Site name and locale settings

### 3. **Twitter Card Tags**
- ✅ Large image card format
- ✅ Twitter handle placeholders (@TandaMedia)
- ✅ Optimized for Twitter sharing

### 4. **Structured Data (JSON-LD)**
Three schema.org implementations:
- ✅ **Organization Schema**: Company information, contact points, area served
- ✅ **WebApplication Schema**: Platform details, features, screenshots
- ✅ **SoftwareApplication Schema**: App store ratings and details

### 5. **Technical SEO**
- ✅ Canonical URL to prevent duplicate content
- ✅ Semantic HTML5 structure
- ✅ Mobile-responsive design
- ✅ Fast loading (minimal external dependencies)
- ✅ Preconnect/DNS-prefetch for performance
- ✅ Proper heading hierarchy (H1, H2, H3)

### 6. **Content SEO**
- ✅ Keyword-rich content naturally integrated
- ✅ Clear value propositions
- ✅ Internal linking to app.tanda.media
- ✅ Descriptive anchor text
- ✅ Alt text for images (logo)

## Deployment Instructions

### Step 1: Set Up Domain Routing
Configure `tanda.media` to serve `landing.html` as the index page:

**Option A: If using GitHub Pages**
1. Rename `landing.html` to `index.html` OR
2. Configure redirect in `_config.yml` or `.htaccess`

**Option B: If using a web server (Nginx/Apache)**
```nginx
# Nginx example
server {
    server_name tanda.media www.tanda.media;
    root /path/to/TandaSite_GitHub;
    index landing.html;
    
    location / {
        try_files $uri $uri/ /landing.html;
    }
}
```

**Option C: If using Cloudflare Pages**
1. Set build output to `TandaSite_GitHub`
2. Set index file to `landing.html`

### Step 2: Update Social Media Links
Replace placeholder Twitter handles in the meta tags:
```html
<meta name="twitter:creator" content="@TandaMedia">
<meta name="twitter:site" content="@TandaMedia">
```

Update `sameAs` array in Organization schema with actual social media URLs.

### Step 3: Verify Structured Data
Test your structured data using:
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)

### Step 4: Submit to Search Engines

**Google Search Console:**
1. Add `tanda.media` as a property
2. Verify ownership
3. Submit sitemap (create one if needed)
4. Request indexing

**Bing Webmaster Tools:**
1. Add site
2. Verify ownership
3. Submit sitemap

### Step 5: Set Up Analytics
Add Google Analytics or your preferred analytics tool:
```html
<!-- Add before </head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## SEO Best Practices Checklist

### On-Page SEO
- ✅ Unique, keyword-rich title (50-60 characters)
- ✅ Compelling meta description (150-160 characters)
- ✅ Proper heading structure (H1 → H2 → H3)
- ✅ Internal linking to app.tanda.media
- ✅ Fast page load speed
- ✅ Mobile-friendly design
- ✅ Semantic HTML

### Technical SEO
- ✅ Canonical URL
- ✅ Structured data (JSON-LD)
- ✅ Open Graph tags
- ✅ Twitter Card tags
- ✅ Proper robots meta tags
- ✅ XML sitemap (create separately)
- ✅ robots.txt (create separately)

### Content SEO
- ✅ Keyword optimization (natural, not stuffed)
- ✅ Clear value propositions
- ✅ Call-to-action buttons
- ✅ Descriptive anchor text
- ✅ Image alt text

## Keyword Strategy

### Primary Keywords
- Tanda
- Video commerce Africa
- Social commerce platform
- TikTok Africa
- Creator monetization

### Secondary Keywords
- Short-form video platform
- Product tagging in videos
- Affiliate marketing platform
- E-commerce integration
- AI recommendations
- Live streaming Africa

### Long-tail Keywords
- "TikTok-style video platform for Africa"
- "Social commerce platform with product tagging"
- "Creator monetization platform Africa"
- "Video shopping platform"

## Performance Optimization

### Current Optimizations
- ✅ Minimal external dependencies
- ✅ Preconnect to fonts.googleapis.com
- ✅ DNS-prefetch for app.tanda.media
- ✅ Inline critical CSS
- ✅ Optimized images (use WebP if possible)

### Additional Recommendations
1. **Image Optimization**: Convert logo to WebP format
2. **Lazy Loading**: Add lazy loading for images
3. **CDN**: Serve static assets via CDN
4. **Caching**: Set proper cache headers
5. **Compression**: Enable Gzip/Brotli compression

## Monitoring & Analytics

### Key Metrics to Track
1. **Organic Traffic**: Monitor via Google Analytics
2. **Keyword Rankings**: Track via Google Search Console
3. **Click-Through Rate**: Monitor in Search Console
4. **Bounce Rate**: Track user engagement
5. **Conversion Rate**: Track CTA clicks to app.tanda.media

### Tools to Use
- Google Search Console
- Google Analytics
- Bing Webmaster Tools
- Ahrefs/SEMrush (optional, for keyword tracking)

## Content Updates

### Regular Updates Needed
1. **Statistics**: Update hero stats (10K+ creators, etc.) as numbers grow
2. **Features**: Add new features as platform evolves
3. **Testimonials**: Add user testimonials when available
4. **Blog Links**: Keep blog links updated
5. **Social Proof**: Add press mentions, awards, etc.

## Next Steps

1. ✅ Landing page created
2. ⏳ Deploy to tanda.media domain
3. ⏳ Submit to search engines
4. ⏳ Set up analytics
5. ⏳ Monitor performance
6. ⏳ Create XML sitemap
7. ⏳ Create robots.txt
8. ⏳ Add Google Analytics
9. ⏳ Set up social media profiles
10. ⏳ Build backlinks strategy

## Additional SEO Enhancements (Future)

1. **Blog Integration**: Link to blog posts for content marketing
2. **Press Releases**: Link to press page for authority
3. **Case Studies**: Add creator success stories
4. **Video Content**: Embed demo videos
5. **FAQ Section**: Add FAQ with schema markup
6. **Local SEO**: If targeting specific African countries
7. **Multilingual**: Add support for African languages

