let graficaMensajes;

let socket = new WebSocket('ws://localhost:3000');

function generarGrafica(datosUsuarios) {
    const labels = datosUsuarios.map(usuario => usuario.user);
    const data = datosUsuarios.map(usuario => usuario.mensajesEnviados);

    const ctx = document.getElementById('graficaMensajes').getContext('2d');
    graficaMensajes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Mensajes enviados por usuario',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function actualizarGrafica(datos) {
    if (Array.isArray(datos.data)) {
        const datosUsuarios = datos.data;
        graficaMensajes.data.labels = datosUsuarios.map(usuario => usuario.user);
        graficaMensajes.data.datasets[0].data = datosUsuarios.map(usuario => usuario.mensajesEnviados);
        graficaMensajes.update();
    } else {
        console.error('Los datos recibidos no son un array:', datos);
    }
}


socket.addEventListener('open', function (event) {
    console.log('Conexión establecida');
});

socket.addEventListener('message', function (event) {
    const datosUsuarios = JSON.parse(event.data);
    console.log('Datos de estadísticas de mensajes recibidos:', datosUsuarios);
    actualizarGrafica(datosUsuarios);
});

document.addEventListener("DOMContentLoaded", function () {
    fetch('http://localhost:3000/mensajes/estadisticas')
        .then(res => res.json())
        .then(data => {
            console.log('Respuesta del servidor (getMensajes):', data);
            const datosUsuarios = data.datosUsuarios;
            generarGrafica(datosUsuarios);
        })
        .catch(console.log);
});
