const chapterNav = document.querySelector('.chapter-nav');
const content = document.getElementById('content');

let currentChapter = null;
let chapterData = null;

// Cargar capítulo
async function loadChapter(num) {
    // Mostrar mensaje de carga
    content.innerHTML = `<div class="loading">⏳ Cargando capítulo ${num}...</div>`;

    try {
        const response = await fetch(`datos/capitulo_${num}.json`);

        if (!response.ok) {
            throw new Error(`El archivo capitulo_${num}.json no existe (Status: ${response.status})`);
        }

        const data = await response.json();
        
        // Verificar que los datos tengan la estructura esperada
        if (!data || !data.subjects || !data.subjects[0] || !data.subjects[0].classes) {
            throw new Error('Estructura de datos inválida: falta "subjects" o "classes"');
        }

        const classData = data.subjects[0].classes[0];
        
        if (!classData || !classData.data) {
            throw new Error('Estructura de datos inválida: falta "data" en la clase');
        }

        const glosario = classData.data.glosario?.glosario || [];
        const preguntas = classData.data.cuestionario_items || [];

        if (preguntas.length === 0) {
            console.warn('⚠️ El capítulo no tiene preguntas definidas');
        }

        chapterData = data;
        currentChapter = num;
        renderChapter(classData, glosario, preguntas);
        updateActiveButton(num);

    } catch (error) {
        console.error('Error cargando capítulo:', error);
        content.innerHTML = `
            <div class="error">
                <h3>❌ Error al cargar el capítulo ${num}</h3>
                <p>${error.message}</p>
                <hr>
                <p><strong>Verifica que:</strong></p>
                <ul style="text-align:left;margin:10px 20px;">
                    <li>El archivo <code>capitulo_${num}.json</code> exista en la carpeta <code>datos/</code></li>
                    <li>El nombre sea exactamente <code>capitulo_${num}.json</code> (todo minúsculas)</li>
                    <li>Estés ejecutando con Live Server o un servidor web</li>
                </ul>
                <button onclick="loadChapter(${num})" style="margin-top:15px;padding:10px 20px;background:#b45309;color:white;border:none;border-radius:8px;cursor:pointer;">
                    🔄 Reintentar
                </button>
            </div>
        `;
    }
}

// Renderizar capítulo
function renderChapter(classData, glosario, preguntas) {
    const name = classData.name || 'Capítulo sin título';

    let html = `
        <h2 class="chapter-title">${name}</h2>
        <div class="chapter-subtitle">Responde las preguntas y verifica tus respuestas</div>
    `;

    if (preguntas.length === 0) {
        html += `
            <div style="background:#fef3c7;padding:20px;border-radius:12px;margin:20px 0;">
                ⚠️ <strong>No hay preguntas</strong> en este capítulo.
                <br><small>Agrega preguntas en el archivo JSON o verifica la estructura.</small>
            </div>
        `;
    } else {
        preguntas.forEach((pregunta, index) => {
            const isMultiple = pregunta.tipo === 'multiple';
            const isFalsoVerdadero = pregunta.tipo === 'falso_verdadero';
            const inputType = isMultiple ? 'checkbox' : 'radio';
            const inputName = `q${index}`;

            html += `
                <div class="question-block" data-index="${index}">
                    <div class="question-text">${index + 1}. ${pregunta.pregunta}</div>
                    <div class="options">
            `;

            // Manejar diferentes formatos de opciones
            const opciones = pregunta.opciones || [];
            opciones.forEach((opcion, optIndex) => {
                let letter = String.fromCharCode(65 + optIndex);
                let value = letter;
                let cleanOption = opcion;
                
                // Para falso/verdadero, usamos el texto completo como valor
                if (isFalsoVerdadero) {
                    value = opcion; // "Verdadero" o "Falso"
                } else {
                    // Limpiar opciones que ya tienen letra
                    if (opcion.match(/^[A-D]\)\s*/)) {
                        cleanOption = opcion.substring(3);
                    } else if (opcion.match(/^[A-D]\.\s*/)) {
                        cleanOption = opcion.substring(3);
                    }
                }
                
                html += `
                    <label class="option-label">
                        <input type="${inputType}" name="${inputName}" value="${value}" />
                        ${isFalsoVerdadero ? '' : letter + ') '}${cleanOption}
                    </label>
                `;
            });

            html += `
                    </div>
                    <button class="btn-validate" data-index="${index}">Verificar</button>
                    <div class="feedback" id="feedback-${index}"></div>
                </div>
            `;
        });
    }

    // Glosario
    if (glosario && glosario.length > 0) {
        html += `
            <div class="glosario-section">
                <h3>📚 Glosario</h3>
                ${glosario.map(item => `
                    <div class="glosario-item">
                        <span class="termino">${item.termino}</span>
                        <span class="definicion">${item.definicion}</span>
                        <span class="grupo">${item.grupo || ''}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    content.innerHTML = html;

    // Eventos de los botones de verificar
    document.querySelectorAll('.btn-validate').forEach(btn => {
        btn.addEventListener('click', handleValidate);
    });
}

// Manejar verificación
function handleValidate(e) {
    const index = parseInt(e.target.dataset.index);
    const block = e.target.closest('.question-block');
    const classData = chapterData.subjects[0].classes[0];
    const preguntas = classData.data.cuestionario_items || [];

    if (index >= preguntas.length) {
        return;
    }

    const pregunta = preguntas[index];
    const feedback = document.getElementById(`feedback-${index}`);

    if (!feedback) return;

    const selectedInputs = block.querySelectorAll(`input:checked`);
    const selectedValues = Array.from(selectedInputs).map(input => input.value);

    let isCorrect = false;
    let correctAnswerText = '';

    // Determinar la respuesta correcta según el tipo
    if (pregunta.tipo === 'falso_verdadero') {
        // Para falso/verdadero, comparar directamente el texto
        // La respuesta correcta puede ser "Verdadero" o "Falso"
        const correct = pregunta.respuesta_correcta;
        // El valor seleccionado es "Verdadero" o "Falso"
        isCorrect = selectedValues.length === 1 && selectedValues[0] === correct;
        correctAnswerText = correct;
    } else if (pregunta.tipo === 'seleccion') {
        // Para selección simple
        const correct = pregunta.respuesta_correcta.charAt(0);
        isCorrect = selectedValues.length === 1 && selectedValues[0] === correct;
        // Buscar la opción correcta para mostrarla
        const correctOption = pregunta.opciones.find(opt => opt.startsWith(correct + ')') || opt.startsWith(correct + '.'));
        correctAnswerText = correctOption || pregunta.respuesta_correcta;
    } else if (pregunta.tipo === 'multiple') {
        // Para selección múltiple
        const corrects = pregunta.respuestas_correctas.map(r => r.charAt(0));
        isCorrect = selectedValues.length === corrects.length && 
                   selectedValues.every(v => corrects.includes(v));
        // Buscar las opciones correctas
        const correctOptions = corrects.map(c => {
            const opt = pregunta.opciones.find(o => o.startsWith(c + ')') || o.startsWith(c + '.'));
            return opt || c;
        });
        correctAnswerText = correctOptions.join(', ');
    } else if (pregunta.tipo === 'texto') {
        // Para preguntas de texto
        const userAnswer = selectedValues.length > 0 ? selectedValues[0].trim().toLowerCase() : '';
        const correct = pregunta.respuesta_correcta.trim().toLowerCase();
        isCorrect = userAnswer === correct;
        correctAnswerText = pregunta.respuesta_correcta;
    }

    // Obtener la cascarita o justificación
    const explicacion = pregunta.cascarita || pregunta.justificacion || 'Sin explicación adicional.';

    // Mostrar feedback
    let feedbackHtml = '';
    if (isCorrect) {
        feedbackHtml = `
            <div class="feedback correct">
                ✅ ¡Correcto!
                <div class="cascarita">💡 ${explicacion}</div>
            </div>
        `;
    } else {
        feedbackHtml = `
            <div class="feedback incorrect">
                ❌ Incorrecto. Respuesta correcta: <strong>${correctAnswerText}</strong>
                <div class="cascarita">💡 ${explicacion}</div>
            </div>
        `;
    }

    feedback.innerHTML = feedbackHtml;
    feedback.style.display = 'block';
}

// Actualizar botón activo
function updateActiveButton(num) {
    document.querySelectorAll('.chapter-nav button').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.chapter) === num);
    });
}

// Eventos de navegación
chapterNav.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const chapter = parseInt(btn.dataset.chapter);
    if (!isNaN(chapter)) loadChapter(chapter);
});

// Cargar capítulo 1 por defecto
loadChapter(1);
