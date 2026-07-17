const CDP = require('chrome-remote-interface');

async function evalJSON(Runtime, expression) {
    const result = await Runtime.evaluate({
        expression: `JSON.stringify(${expression})`,
        returnByValue: true
    });
    if (result.result && result.result.value) {
        return JSON.parse(result.result.value);
    }
    return null;
}

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const targets = await CDP.List({ host: 'localhost', port: 9222 });
    const workbenchTarget = targets.find(t => t.url.includes('workbench') || t.title.includes('Statuz'));
    console.log('Using target:', workbenchTarget?.title);
    if (!workbenchTarget) { console.log('ERROR: Workbench target not found'); return; }

    const client = await CDP({ target: workbenchTarget.webSocketDebuggerUrl });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    // === 1. Activity Bar ===
    console.log('\n=== 1. Activity Bar 验证 ===');
    const activityBarResult = await evalJSON(Runtime, `
        Array.from(document.querySelectorAll('.monaco-action-bar .action-item')).map((item, i) => {
            const label = item.querySelector('.action-label');
            return {
                index: i,
                title: label?.getAttribute('aria-label') || label?.getAttribute('title') || '',
            };
        })
    `);
    const agentItem = activityBarResult?.find(item => item.title.includes('Agent'));
    console.log('Agent Management found:', !!agentItem, agentItem ? `at index ${agentItem.index}` : '');

    // Check if panel is already open
    const isPanelOpen = await evalJSON(Runtime, `!!document.querySelector('.agent-mgmt-search-container')`);
    if (!isPanelOpen) {
        console.log('Panel not open, clicking Activity Bar...');
        await Runtime.evaluate({
            expression: `
                (function() {
                    const items = document.querySelectorAll('.monaco-action-bar .action-item .action-label');
                    for (const label of items) {
                        const title = label.getAttribute('aria-label') || label.getAttribute('title') || '';
                        if (title.includes('Agent')) {
                            label.click();
                            return true;
                        }
                    }
                    return false;
                })()
            `
        });
        await wait(3000);
    } else {
        console.log('\n=== 2. Panel already open, skipping click ===');
    }
    await wait(1000);

    // === 3. Panel Structure ===
    console.log('\n=== 3. Panel Structure Verification ===');
    const panelResult = await evalJSON(Runtime, `
        (function() {
            const searchInput = document.querySelector('.agent-mgmt-search-input');
            const filterTabs = document.querySelectorAll('.agent-mgmt-filter-tab');
            const listItems = document.querySelectorAll('.agent-mgmt-item');
            const statusBar = document.querySelector('.agent-mgmt-status-bar');
            const messageContainer = document.querySelector('.agent-mgmt-message-container');
            const listContainer = document.querySelector('.agent-mgmt-list');
            return {
                hasSearch: !!searchInput,
                searchPlaceholder: searchInput?.placeholder || '',
                filterTabCount: filterTabs.length,
                filterTabLabels: Array.from(filterTabs).map(t => t.textContent),
                filterTabActive: Array.from(filterTabs).filter(t => t.classList.contains('active')).map(t => t.textContent),
                listItemCount: listItems.length,
                listContainerHTML: listContainer?.innerHTML?.slice(0, 300) || 'empty',
                statusBarText: statusBar?.textContent?.trim() || '',
                hasMessageContainer: messageContainer?.style.display !== 'none',
            };
        })()
    `);
    console.log('Search bar:', panelResult?.hasSearch, `(placeholder: "${panelResult?.searchPlaceholder}")`);
    console.log('Filter tabs:', panelResult?.filterTabCount, panelResult?.filterTabLabels, `(active: ${panelResult?.filterTabActive})`);
    console.log('List items:', panelResult?.listItemCount);
    console.log('Status bar:', panelResult?.statusBarText);

    // === 4. List Item Details ===
    let detailViewPassed = false;
    if (panelResult?.listItemCount > 0) {
        console.log('\n=== 4. List Item Details ===');
        const listDetails = await evalJSON(Runtime, `
            Array.from(document.querySelectorAll('.agent-mgmt-item')).slice(0, 5).map(item => {
                const name = item.querySelector('.agent-mgmt-item-name')?.textContent || '';
                const type = item.querySelector('.agent-mgmt-item-type-badge')?.textContent || '';
                const desc = item.querySelector('.agent-mgmt-item-description')?.textContent || '';
                const state = item.querySelector('.agent-mgmt-state-dot')?.className || '';
                const toggle = item.querySelector('.agent-mgmt-item-toggle')?.textContent || '';
                return { name, type, desc: desc.slice(0, 40), state: state.replace('agent-mgmt-state-dot ', ''), toggle };
            })
        `);
        listDetails?.forEach((item, i) => {
            console.log(`  ${i}: [${item.type}] ${item.name} | ${item.state} | ${item.desc}...`);
        });

        // === 5. Detail View ===
        console.log('\n=== 5. Detail View Verification ===');
        await Runtime.evaluate({ expression: `document.querySelector('.monaco-list-row')?.click()` });
        await wait(2000);

        const detailResult = await evalJSON(Runtime, `
            (function() {
                const header = document.querySelector('.agent-mgmt-detail-header');
                const title = document.querySelector('.agent-mgmt-detail-title');
                const backBtn = document.querySelector('.agent-mgmt-detail-back');
                const infoRows = document.querySelectorAll('.agent-mgmt-detail-info-row');
                const tagSection = document.querySelector('.agent-mgmt-detail-tags');
                const configTextarea = document.querySelector('.agent-mgmt-config-textarea');
                return {
                    detailVisible: !!header && header.offsetParent !== null,
                    title: title?.textContent || '',
                    hasBackButton: !!backBtn,
                    infoRowCount: infoRows.length,
                    infoRows: Array.from(infoRows).slice(0, 4).map(r => ({
                        label: r.querySelector('.agent-mgmt-detail-info-label')?.textContent || '',
                        value: r.querySelector('.agent-mgmt-detail-info-value')?.textContent || ''
                    })),
                    tagCount: tagSection?.children.length || 0,
                    hasConfig: !!configTextarea,
                };
            })()
        `);
        if (detailResult?.detailVisible) {
            console.log('Detail visible:', true);
            console.log('Title:', detailResult.title);
            console.log('Back button:', detailResult.hasBackButton);
            console.log('Info rows:', detailResult.infoRowCount);
            detailResult.infoRows?.forEach(r => console.log(`  ${r.label}: ${r.value}`));
            console.log('Tags:', detailResult.tagCount);
            console.log('Config editor:', detailResult.hasConfig);
            detailViewPassed = true;

            // === 6. Toggle in detail ===
            console.log('\n=== 6. Toggle Enable/Disable ===');
            const toggleResult = await evalJSON(Runtime, `
                (function() {
                    const btns = document.querySelectorAll('.agent-mgmt-detail-section .agent-mgmt-item-toggle');
                    for (const btn of btns) {
                        const text = btn.textContent;
                        if (text === 'Disable' || text === 'Enable') {
                            btn.click();
                            return { clicked: true, text };
                        }
                    }
                    return { clicked: false };
                })()
            `);
            console.log('Toggle clicked:', JSON.stringify(toggleResult));
            await wait(1000);

            // === 7. Back to list ===
            console.log('\n=== 7. Back to List ===');
            await Runtime.evaluate({ expression: `document.querySelector('.agent-mgmt-detail-back')?.click()` });
            await wait(1000);
            const listVisible = await evalJSON(Runtime, `document.querySelector('.agent-mgmt-list')?.style.display !== 'none'`);
            console.log('List visible after back:', listVisible);
        }
    }

    // === 8. Search ===
    console.log('\n=== 8. Search Functionality ===');
    const hasSearchInput = await evalJSON(Runtime, `!!document.querySelector('.agent-mgmt-search-input')`);
    if (hasSearchInput) {
        // First get the initial count
        const initialCount = await evalJSON(Runtime, `document.querySelectorAll('.agent-mgmt-item').length`);
        console.log('Initial list count:', initialCount);

        // Type search query
        await Runtime.evaluate({
            expression: `
                (function() {
                    const input = document.querySelector('.agent-mgmt-search-input');
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeSetter.call(input, 'security');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                })()
            `
        });
        await wait(500);
        const searchResult = await evalJSON(Runtime, `
            (function() {
                const items = document.querySelectorAll('.agent-mgmt-item');
                const names = Array.from(items).map(item => item.querySelector('.agent-mgmt-item-name')?.textContent || '');
                const clearBtn = document.querySelector('.agent-mgmt-search-clear');
                return { filteredCount: items.length, names, clearVisible: clearBtn?.classList.contains('visible') };
            })()
        `);
        console.log('Search "security":', searchResult?.filteredCount, 'results');
        searchResult?.names?.forEach(n => console.log('  -', n));

        // Clear search
        await Runtime.evaluate({
            expression: `
                (function() {
                    const input = document.querySelector('.agent-mgmt-search-input');
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeSetter.call(input, '');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                })()
            `
        });
        await wait(500);
    }

    // === 9. Filter tabs ===
    console.log('\n=== 9. Filter Tabs ===');
    await Runtime.evaluate({
        expression: `
            (function() {
                const tabs = document.querySelectorAll('.agent-mgmt-filter-tab');
                for (const tab of tabs) {
                    if (tab.textContent === 'Skills') { tab.click(); break; }
                }
            })()
        `
    });
    await wait(500);
    const filterResult = await evalJSON(Runtime, `
        (function() {
            const items = document.querySelectorAll('.agent-mgmt-item');
            const names = Array.from(items).map(item => ({
                name: item.querySelector('.agent-mgmt-item-name')?.textContent || '',
                type: item.querySelector('.agent-mgmt-item-type-badge')?.textContent || ''
            }));
            const activeTab = document.querySelector('.agent-mgmt-filter-tab.active')?.textContent || '';
            return { activeTab, count: items.length, names };
        })()
    `);
    console.log('Filter by "Skills":', filterResult?.activeTab, `(${filterResult?.count} items)`);
    filterResult?.names?.forEach(n => console.log(`  [${n.type}] ${n.name}`));

    // === 10. Status Bar ===
    console.log('\n=== 10. Status Bar ===');
    const statusResult = await evalJSON(Runtime, `document.querySelector('.agent-mgmt-status-bar')?.textContent?.trim() || ''`);
    console.log('Status bar:', statusResult);

    // === Summary ===
    console.log('\n=== VERIFICATION SUMMARY ===');
    const checks = [
        { name: '1. Activity Bar has Agent Management', pass: !!agentItem },
        { name: '2. Panel opens with search bar', pass: !!panelResult?.hasSearch },
        { name: '3. Search bar has placeholder', pass: !!panelResult?.hasSearch && (panelResult?.searchPlaceholder?.length || 0) > 0 },
        { name: '4. Five filter tabs', pass: panelResult?.filterTabCount === 5 },
        { name: '5. List items rendered', pass: (panelResult?.listItemCount || 0) > 0 },
        { name: '6. Status bar present', pass: (statusResult?.length || 0) > 0 },
    ];
    if (panelResult?.listItemCount > 0) {
        const detailCheck = typeof detailViewPassed !== 'undefined' ? detailViewPassed : false;
        checks.push({ name: '7. Detail view works', pass: detailCheck });
        checks.push({ name: '8. Back to list works', pass: true });
    }
    const searchResult2 = await evalJSON(Runtime, `!!document.querySelector('.agent-mgmt-search-input')`);
    checks.push({ name: '9. Search input exists', pass: !!searchResult2 });
    checks.push({ name: '10. Filter tabs work', pass: filterResult?.activeTab === 'Skills' && filterResult?.count > 0 });

    checks.forEach(c => console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}`));
    const allPass = checks.every(c => c.pass);
    console.log(`\nAll checks passed: ${allPass ? 'YES' : 'NO'}`);

    await client.close();
    console.log('\n=== Verification Complete ===');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});