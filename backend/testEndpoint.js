const fetch = require('node-fetch');

async function testEndpoint() {
  try {
    // Login
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'juanperez50@gmail.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    console.log('Login:', loginData);

    if (loginData.token) {
      // Asignados
      const asignadosRes = await fetch('http://localhost:3000/api/documentos-requeridos/usuario/asignados', {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
      });
      const asignadosData = await asignadosRes.json();
      console.log('Asignados:', asignadosData);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testEndpoint();