// Utility script to batch update files with dark mode classes
const fs = require('fs');
const path = require('path');

const updates = [
    // White backgrounds to dark
    { from: 'class="bg-white rounded-lg shadow', to: 'class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700' },
    { from: 'class="bg-white rounded-lg max', to: 'class="bg-white dark:bg-gray-800 rounded-2xl max' },
    
    // Text colors
    { from: 'text-gray-900">', to: 'text-gray-900 dark:text-white">' },
    { from: 'text-gray-500">', to: 'text-gray-500 dark:text-gray-400">' },
    { from: 'text-gray-700">', to: 'text-gray-700 dark:text-gray-300">' },
    
    // Table headers
    { from: 'bg-gray-50">', to: 'bg-gray-50 dark:bg-gray-700">' },
    { from: 'divide-y divide-gray-200">', to: 'divide-y divide-gray-200 dark:divide-gray-700">' },
    
    // Borders
    { from: 'border-gray-200">', to: 'border-gray-200 dark:border-gray-700">' },
    { from: 'border-gray-300 rounded', to: 'border-gray-300 dark:border-gray-600 rounded' },
    
    // Hover states
    { from: 'hover:bg-gray-50"', to: 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"' },
    { from: 'hover:bg-gray-100"', to: 'hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"' },
];

function updateFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    updates.forEach(({ from, to }) => {
        if (content.includes(from) && !content.includes(to)) {
            content = content.replaceAll(from, to);
            modified = true;
        }
    });
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
        return true;
    }
    return false;
}

// Files to update
const files = [
    'src/pages/admin/History.svelte',
    'src/pages/admin/Payments.svelte',
    'src/pages/admin/Schedules.svelte',
];

let totalUpdated = 0;
files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        if (updateFile(fullPath)) totalUpdated++;
    } else {
        console.log(`File not found: ${fullPath}`);
    }
});

console.log(`\nTotal files updated: ${totalUpdated}/${files.length}`);
