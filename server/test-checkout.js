// Removing node-fetch import
async function testCheckout() {
    console.log("Mocking guest checkout session to Express...");
    const mockPayload = {
        price: 150.00,
        params: {
            length: { value: 24, unit: 'in' },
            height: { value: 12, unit: 'in' },
            ribCount: 4,
            backplaneBezier: null
        },
        userEmail: null // testing guest!
    };

    try {
        const response = await fetch('http://localhost:3001/api/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockPayload)
        });
        
        const data = await response.json();
        console.log("Response:", data);
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

testCheckout();
