import fs from 'fs';
import path from 'path';

// Source and destination paths for icons
const iconMappings = [
  { src: 'icons/icon-16.png', dest: 'public/assets/icons/icon-16.png' },
  { src: 'icons/icon-48.png', dest: 'public/assets/icons/icon-48.png' },
  { src: 'icons/icon-128.png', dest: 'public/assets/icons/icon-128.png' }
];

// Ensure destination directory exists
const destDir = 'public/assets/icons';
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log(`Created directory: ${destDir}`);
}

// Copy each icon
iconMappings.forEach(({ src, dest }) => {
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✓ Copied ${src} to ${dest}`);
    } else {
      console.warn(`⚠ Source file not found: ${src}`);
    }
  } catch (error) {
    console.error(`✗ Failed to copy ${src}: ${error.message}`);
  }
});

console.log('Icon copying completed!');
