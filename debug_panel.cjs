const CDP = require('chrome-remote-interface');

async function main() {
    const targets = await CDP.List({ host: 'localhost', port: 9222 });
    const target = targets.find(t => t.url.includes('workbench') || t.title.includes('Statuz'));
    const client = await CDP({ target: target.webSocketDebuggerUrl });
    const { Runtime } = client;
    await Runtime.enable();
    
    const result = await Runtime.evaluate({
        expression: `JSON.stringify(document.querySelector('.sidebar')?.innerHTML?.slice(0, 4000) || 'no sidebar')`
    });
    console.log(result.result.value);
    await client.close();
}
main().catch(console.error);