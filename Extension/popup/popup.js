document.addEventListener('DOMContentLoaded', () => {

    const titleEl = document.getElementById('current-title');
    const urlEl = document.getElementById('current-url');
    const categorySelect = document.getElementById('category-select');
    const newCategoryInput = document.getElementById('new-category');
    const saveBtn = document.getElementById('save-btn');
    const linksList = document.getElementById('links-list');
    const viewCategorySelect = document.getElementById('view-category-select');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    let currentTab = { title: '', url: '' };

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs.length) {
            titleEl.textContent = 'No active tab found';
            urlEl.textContent = '';
            return;
        }

        currentTab = {
            title: tabs[0].title || 'No title',
            url: tabs[0].url || ''
        };

        titleEl.textContent = currentTab.title;
        urlEl.textContent = currentTab.url;
    });

    function loadCategories() {
        chrome.storage.local.get(['categories'], result => {
            const categories = result.categories || [];

            categorySelect.innerHTML = `<option value="">Select existing category</option>`;
            categories.forEach(cat => {
                categorySelect.insertAdjacentHTML('beforeend', `<option value="${cat}">${cat}</option>`);
            });

            viewCategorySelect.innerHTML = `<option value="">-- Select a category --</option>`;
            categories.forEach(cat => {
                viewCategorySelect.insertAdjacentHTML('beforeend', `<option value="${cat}">${cat}</option>`);
            });
        });
    }

    function loadLinks(selectedCategory = '') {
        chrome.storage.local.get(['links'], result => {
            const links = result.links || [];
            linksList.innerHTML = '';

            if (!selectedCategory) {
                linksList.innerHTML = `<li class="link-item">Please select a category to view links.</li>`;
                return;
            }

            const filtered = links.filter(link => link.category === selectedCategory);

            if (!filtered.length) {
                linksList.innerHTML = `<li class="link-item">No links saved in this category.</li>`;
                return;
            }

            filtered.forEach(link => {
                const li = document.createElement('li');
                li.className = 'link-item';
                li.innerHTML = `
                    <div class="link-title">${link.title}</div>
                    <div class="link-url"><a href="${link.url}" target="_blank">${link.url}</a></div>
                    <button class="delete-btn" data-url="${encodeURIComponent(link.url)}" data-category="${encodeURIComponent(link.category)}">Delete</button>
                `;
                linksList.appendChild(li);
            });

            // Add delete listeners
            linksList.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const url = decodeURIComponent(btn.dataset.url);
                    const category = decodeURIComponent(btn.dataset.category);
                    if (confirm(`Delete this link from "${category}"?`)) {
                        deleteLink(url, category);
                    }
                });
            });
        });
    }

    function deleteLink(url, category) {
        chrome.storage.local.get(['links', 'categories'], result => {
            let links = result.links || [];
            let categories = result.categories || [];

            links = links.filter(link => !(link.url === url && link.category === category));

            if (!links.some(link => link.category === category)) {
                categories = categories.filter(c => c !== category);
            }

            chrome.storage.local.set({ links, categories }, () => {
                console.log(`Deleted link: ${url} from ${category}`);
                loadCategories();

                if (categories.includes(category)) {
                    viewCategorySelect.value = category;
                    loadLinks(category);
                } else {
                    viewCategorySelect.value = '';
                    loadLinks();
                }
            });
        });
    }

    saveBtn.addEventListener('click', () => {
        const selectedCategory = categorySelect.value.trim();
        const newCategory = newCategoryInput.value.trim();
        const categoryToUse = newCategory || selectedCategory || 'Uncategorized';

        if (!currentTab.url) {
            alert('No URL to save!');
            return;
        }

        const newLink = {
            title: currentTab.title,
            url: currentTab.url,
            category: categoryToUse
        };

        chrome.storage.local.get(['links', 'categories'], result => {
            let links = result.links || [];
            let categories = result.categories || [];

            if (links.some(link => link.url === newLink.url && link.category === newLink.category)) {
                alert('This link is already saved in this category!');
                return;
            }

            links.push(newLink);

            if (newCategory && !categories.includes(newCategory)) {
                categories.push(newCategory);
            }

            chrome.storage.local.set({ links, categories }, () => {
                console.log('Link and categories saved');
                newCategoryInput.value = '';
                loadCategories();
                loadLinks(categoryToUse);
                viewCategorySelect.value = categoryToUse;
            });
        });
    });

    viewCategorySelect.addEventListener('change', () => {
        loadLinks(viewCategorySelect.value);
    });

    exportBtn.addEventListener('click', () => {
        chrome.storage.local.get(['links', 'categories'], result => {
            const dataStr = JSON.stringify(
                {
                    links: result.links || [],
                    categories: result.categories || []
                },
                null,
                2
            );

            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'link-collector-backup.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('Exported data as JSON');
        });
    });

    importBtn.addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', () => {
        const file = importFile.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.links || !data.categories) {
                    alert('Invalid backup file!');
                    return;
                }

                chrome.storage.local.set(
                    { links: data.links, categories: data.categories },
                    () => {
                        alert('Data imported successfully!');
                        loadCategories();
                        if (viewCategorySelect.value) {
                            loadLinks(viewCategorySelect.value);
                        } else {
                            loadLinks();
                        }
                    }
                );
            } catch (error) {
                console.error(error);
                alert('Error reading backup file!');
            }
        };

        reader.readAsText(file);
        importFile.value = '';
    });

    loadCategories();
    loadLinks();
});
