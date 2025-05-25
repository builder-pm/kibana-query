# Elasticsearch Query Helper - Side Panel Extension

This Chrome extension has been converted from a popup-based to a sidepanel-based extension, providing a better user experience with more space and persistent state.

## 🚀 Loading the Extension

1. **Open Chrome Extension Management**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

2. **Load the Extension**
   - Click "Load unpacked"
   - Select the `dist` folder: `C:\Users\naman\OneDrive\Desktop\Elastic Query\GoogleJules\kibana-query\dist`

3. **Verify Installation**
   - You should see the "Elasticsearch Query Helper" extension listed
   - Note the extension icon in the Chrome toolbar

## 🎯 Using the Side Panel

### Opening the Side Panel
- **Method 1**: Click the extension icon in the Chrome toolbar
- **Method 2**: Right-click the extension icon → "Open side panel"

### Features
- **Persistent State**: The side panel stays open while you browse
- **Tab Context**: Shows which tab you're currently working on
- **Full Interface**: Access to all Elasticsearch query features
- **Better Space**: More room for complex queries and results

## 🔧 Development

### Building the Extension
```bash
npm run build
```

### Copying Icons
```bash
npm run copy-icons
```

### Development Mode
```bash
npm run dev
```

## 📁 Key Files

- **Manifest**: `public/manifest.json` - Extension configuration
- **Background Script**: `src/background.js` - Handles sidepanel behavior
- **Main App**: `src/App.jsx` - React application
- **Icons**: `icons/` - Original icon files
- **Build Output**: `dist/` - Ready-to-load extension

## 🔄 Side Panel vs Popup Changes

### What Changed:
1. **Manifest Configuration**
   - Added `"sidePanel"` permission
   - Replaced `"default_popup"` with `"side_panel"` configuration
   - Added background service worker

2. **Background Script**
   - Handles extension icon clicks
   - Opens/closes side panel
   - Manages communication between components

3. **UI Enhancements**
   - Added current tab information
   - Optimized for vertical side panel layout
   - Better header and footer design

### Benefits:
- **More Space**: Wider interface for complex queries
- **Persistent**: Stays open while browsing
- **Context-Aware**: Shows current tab information
- **Better UX**: Less interruption to user workflow

## 🐛 Troubleshooting

### Extension Not Loading
- Check that `dist/manifest.json` exists
- Verify all required files are in `dist/`
- Check browser console for errors

### Side Panel Not Opening
- Ensure Chrome version supports Side Panel API (Chrome 114+)
- Check extension permissions
- Look for errors in `chrome://extensions/` 

### Icons Not Showing
- Run `npm run copy-icons` before building
- Verify icons exist in `dist/assets/icons/`
- Check file permissions

## 📊 Architecture

```
┌─────────────────────────────────────────┐
│            Chrome Extension             │
├─────────────────┬───────────────────────┤
│   Side Panel    │   Background Script   │
│   (React App)   │   (Service Worker)    │
├─────────────────┼───────────────────────┤
│ • Query Builder │ • Panel Management    │
│ • Results View  │ • Tab Communication   │
│ • Settings      │ • Message Routing     │
│ • Chat Interface│ • Storage Handling    │
└─────────────────┴───────────────────────┘
```

## 🎯 Next Steps

1. **Test the Extension**: Load in Chrome and verify sidepanel functionality
2. **Elasticsearch Integration**: Connect to your ES clusters
3. **Custom Queries**: Test the natural language query generation
4. **Feedback Loop**: Use the built-in feedback system for improvements
