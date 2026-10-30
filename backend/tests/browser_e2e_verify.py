import os
import sys
import json
import time
import asyncio
import subprocess
import urllib.request
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9222

async def send_cdp(ws, method, params=None, msg_id=[1]):
    mid = msg_id[0]
    msg_id[0] += 1
    payload = {"id": mid, "method": method, "params": params or {}}
    await ws.send(json.dumps(payload))
    while True:
        resp = json.loads(await ws.recv())
        if resp.get("id") == mid:
            return resp

async def run_browser_automation():
    print("Launching Chrome in headless mode with remote debugging...")
    proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--no-sandbox",
        "--disable-gpu",
        "--window-size=1600,1000",
        "about:blank"
    ])
    
    time.sleep(1.5)
    
    try:
        # Get websocket debugger URL
        endpoint = f"http://127.0.0.1:{PORT}/json"
        with urllib.request.urlopen(endpoint) as res:
            tabs = json.loads(res.read().decode())
        ws_url = tabs[0]["webSocketDebuggerUrl"]
        print(f"Connected to Chrome WebSocket: {ws_url}")
        
        async with websockets.connect(ws_url, max_size=50*1024*1024) as ws:
            # Enable Page and Runtime
            await send_cdp(ws, "Page.enable")
            await send_cdp(ws, "Runtime.enable")
            
            # Navigate to local frontend
            print("Navigating to http://127.0.0.1:5173/ ...")
            await send_cdp(ws, "Page.navigate", {"url": "http://127.0.0.1:5173/"})
            await asyncio.sleep(3.5)
            
            # Helper to take screenshot
            async def capture(filename):
                shot = await send_cdp(ws, "Page.captureScreenshot", {"format": "png"})
                import base64
                data = base64.b64decode(shot["result"]["data"])
                with open(filename, "wb") as f:
                    f.write(data)
                print(f"[OK] Captured screenshot: {filename} ({len(data)} bytes)")

            # 1. Capture Overview
            await capture("screenshot_1_overview.png")

            # Helper to evaluate JS in page
            async def evaluate(js_code):
                res = await send_cdp(ws, "Runtime.evaluate", {
                    "expression": js_code,
                    "returnByValue": True,
                    "awaitPromise": True
                })
                return res.get("result", {}).get("value")

            # 2. Click Route Analysis icon (second button in nav)
            print("Clicking Route Analysis icon...")
            await evaluate("""
                const navBtns = document.querySelectorAll('nav button');
                if (navBtns.length > 1) { navBtns[1].click(); }
            """)
            await asyncio.sleep(1.0)
            await capture("screenshot_2_routes_view.png")

            # 3. Click the first route in the list to select and highlight it
            print("Selecting Route 1 (Primary Corridor)...")
            await evaluate("""
                const routeCards = document.querySelectorAll('aside div.cursor-pointer');
                if (routeCards.length > 0) { routeCards[0].click(); }
            """)
            await asyncio.sleep(1.5)
            await capture("screenshot_3_route_highlighted.png")

            # 4. Click 'Simulate 3 Alternatives' button
            print("Clicking 'Simulate 3 Alternatives'...")
            await evaluate("""
                const btns = Array.from(document.querySelectorAll('button'));
                const simBtn = btns.find(b => b.textContent && b.textContent.includes('Simulate'));
                if (simBtn) { simBtn.click(); }
            """)
            print("Waiting for 3-alternative simulation physics calculations...")
            await asyncio.sleep(4.0)
            await capture("screenshot_4_simulation_results.png")

            # 5. Click Comparative Charts Tab
            print("Switching to Comparative Charts tab...")
            await evaluate("""
                const btns = Array.from(document.querySelectorAll('button'));
                const chartTab = btns.find(b => b.textContent && b.textContent.includes('Comparative Charts'));
                if (chartTab) { chartTab.click(); }
            """)
            await asyncio.sleep(1.0)
            await capture("screenshot_5_charts.png")

            # 6. Click Spillover Link Effects Tab
            print("Switching to Spillover Link Effects tab...")
            await evaluate("""
                const btns = Array.from(document.querySelectorAll('button'));
                const spillTab = btns.find(b => b.textContent && b.textContent.includes('Spillover Link Effects'));
                if (spillTab) { spillTab.click(); }
            """)
            await asyncio.sleep(1.0)
            await capture("screenshot_6_spillover.png")

            # 7. Click Evidence Brief to open Decision Report Modal
            print("Opening Official Decision Brief modal...")
            await evaluate("""
                const btns = Array.from(document.querySelectorAll('button'));
                const briefBtn = btns.find(b => b.textContent && b.textContent.includes('Evidence Brief'));
                if (briefBtn) { briefBtn.click(); }
            """)
            await asyncio.sleep(1.0)
            await capture("screenshot_7_decision_report.png")

            # Check for any unhandled JS errors in console
            console_eval = await evaluate("""
                window.__errors || []
            """)
            print(f"Console errors: {console_eval}")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()
        print("Browser automation finished cleanly.")

if __name__ == "__main__":
    asyncio.run(run_browser_automation())

