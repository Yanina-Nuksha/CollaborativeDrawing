const stage = new Konva.Stage({
    container: 'drawingCanvas',
    width: 1000,
    height: 600,
    scale : { x: 1, y: 1 }
});

const layer = new Konva.Layer();

const background = new Konva.Rect({
    x: 0,
    y: 0,
    width: stage.width(),
    height: stage.height(),
    fill: 'white', 
    listening: false 
});
layer.add(background);
layer.clip({
    x: 0,
    y: 0,
    width: stage.width(),
    height: stage.height(),
});
stage.add(layer);

stage.on('resize', () => {
    stage.width(window.innerWidth);
    stage.height(window.innerHeight);
    background.width(stage.width());
    background.height(stage.height());
});

let minScale = 0.3;
let maxScale = 20;
let isDrawing = false;
let isEraser = false;
let isTextMode = false;
let isEyedropperMode = false;
let selectedTextNode = null;
let selectedImage = null;
let shapeMode = 'pencil'; 
let currentLine;
let strokeColor = "#000000";
let strokeWidth = 2;
let history = [];
let redoStack = [];
let currentPoints = [];
let lastPos = null;
let pressure = 1;
let opacity = 1;
let transformer = null;

document.getElementById('brushSelector').addEventListener('change', (e) => {
    const shapeSelector = document.getElementById('shapeSelector');
    if (!shapeSelector.value) {
        setShapeMode(e.target.value);
    }
});

document.getElementById('shapeSelector').addEventListener('change', (e) => {
    if (e.target.value) {
        setShapeMode(e.target.value);
    } else {
        setShapeMode(document.getElementById('brushSelector').value);
    }
});

const eraserButton = document.getElementById("eraser");
eraserButton.addEventListener("click", () => {
    isEraser = !isEraser
    if (isEraser) {
        eraserButton.classList.add("active"); 
        drawingCanvas.classList.add("eraser-active"); 
    } else {
        eraserButton.classList.remove("active"); 
        drawingCanvas.classList.remove("eraser-active"); 
    }
});
const textButton = document.getElementById("addText");
textButton.addEventListener("click", () => {
    isTextMode = !isTextMode;
    if (isTextMode) {
        textButton.classList.add("active");
        drawingCanvas.classList.add("text-active");
    } else {
        textButton.classList.remove("active");
        drawingCanvas.classList.remove("text-active");
    }
});
let bringToFrontButton = document.getElementById('bringToFrontButton');
let sendToBackButton = document.getElementById('sendToBackButton');
let closeImageEditButton = document.getElementById('closeImageEditButton');
let bringForwardButton = document.getElementById('bringForwardButton');
let sendBackwardButton = document.getElementById('sendBackwardButton');
let deleteImageButton = document.getElementById('deleteImageButton');
document.getElementById('colorPicker').addEventListener('change', (e) => strokeColor = e.target.value);
document.getElementById('thickness').addEventListener('input', (e) => strokeWidth = e.target.value);
document.getElementById('opacity').addEventListener('input', (e) => opacity = parseFloat(e.target.value));

function setShapeMode(mode) {
    shapeMode = mode;
    isTextMode = false;
    isEyedropperMode = false;
}

stage.on('pointerdown', (event) => {
    if (ctrlPressed) {
        isScaling = true;
        return;
    }
    if (selectedImage) return;
    if (isEyedropperMode) return;
    if (isTextMode) return;
    const clickedOn = event.target;
    if (clickedOn.className === "Text") return;

    isDrawing = true;

    lastPos = stage.getPointerPosition();
    const pointer = stage.getPointerPosition();
    const pos = {
        x: (pointer.x - stage.x()) / stage.scaleX(),
        y: (pointer.y - stage.y()) / stage.scaleY()
    };
    currentPoints = [pos.x, pos.y];

    pressure = event.evt.pressure || 1;
    const strokeColor = isEraser ? "#FFFFFF" : document.getElementById('colorPicker').value;

    if (shapeMode === 'straightline') {
        currentLine = new Konva.Line({
            stroke: isEraser ? "#FFFFFF" : strokeColor,
            strokeWidth: strokeWidth,
            points: [pos.x, pos.y, pos.x, pos.y],
            lineCap: 'round',
            lineJoin: 'round',
            opacity: opacity,
            userid: sessionStorage.getItem('userId'),
        });
    } else if (shapeMode === 'rectangle' || shapeMode === 'square') {
        currentLine = new Konva.Rect({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: isEraser ? "#FFFFFF" : strokeColor,
            strokeWidth: strokeWidth,
            opacity: opacity,
            userid: sessionStorage.getItem('userId'),
        });
    } else if (shapeMode === 'ellipse') {
        currentLine = new Konva.Ellipse({
            x: pos.x,
            y: pos.y,
            radiusX: 0,
            radiusY: 0,
            stroke: isEraser ? "#FFFFFF" : strokeColor,
            strokeWidth: strokeWidth,
            opacity: opacity,
            userid: sessionStorage.getItem('userId'),
        });
    } else if (shapeMode === 'airbrush') {
        currentLine = new Konva.Group({
            stroke: isEraser ? "#FFFFFF" : strokeColor,
            strokeWidth: strokeWidth,
            opacity: opacity,
            userid: sessionStorage.getItem('userId'),
            });
    } else if (shapeMode === 'pen') {
        currentLine = new Konva.Group({
            stroke: isEraser ? "#FFFFFF" : strokeColor,
            strokeWidth: strokeWidth,
            opacity: opacity,
            userid: sessionStorage.getItem('userId'),
        });
    } else if (shapeMode === 'pencil') {
        currentLine = new Konva.Line({
            stroke: isEraser ? "#FFFFFF" : strokeColor,
            strokeWidth: strokeWidth,
            points: [],
            lineCap: 'round',
            lineJoin: 'round',
            opacity: opacity,
            userid: sessionStorage.getItem('userId'),
        });
    }

    layer.add(currentLine);
});

stage.on('pointermove', (event) => {
    event.evt.preventDefault();
    if (!isDrawing) return;
    const pointer = stage.getPointerPosition();
    const pos = {
        x: (pointer.x - stage.x()) / stage.scaleX(),
        y: (pointer.y - stage.y()) / stage.scaleY()
    };

    if (pressure === 0) return;
    pressure = event.evt.pressure || 1
    let dynamicOpacity = Math.max(0.2, opacity * pressure); 

    if (shapeMode === 'straightline') {
        currentLine.points([currentPoints[0], currentPoints[1], pos.x, pos.y]);
    } else if (shapeMode === 'rectangle' || shapeMode === 'square') {
        let startX = currentPoints[0];
        let startY = currentPoints[1];
        let width = pos.x - startX;
        let height = pos.y - startY;

        if (shapeMode === 'square') {
            width = height = Math.min(Math.abs(width), Math.abs(height)) * (width < 0 ? -1 : 1);
        }
        currentLine.setAttrs({ x: startX, y: startY, width, height });
    } else if (shapeMode === 'ellipse') {
        let startX = currentLine.x();
        let startY = currentLine.y();
        let radiusX = Math.abs(pos.x - startX);
        let radiusY = Math.abs(pos.y - startY);

        currentLine.radiusX(radiusX);
        currentLine.radiusY(radiusY);
    } else if (shapeMode === 'pencil') {
        currentPoints.push(pos.x, pos.y);
        currentLine.points(currentPoints);
    } else if (shapeMode === 'pen') {
        let speed = Math.sqrt(Math.pow(pos.x - lastPos.x, 2) + Math.pow(pos.y - lastPos.y, 2));
        let width = Math.max(1, strokeWidth - speed / 2);

        let segment = new Konva.Line({
            stroke: isEraser ? "#FFFFFF" : strokeColor,
            strokeWidth: width,
            points: [lastPos.x, lastPos.y, pos.x, pos.y],
            lineCap: 'round',
            lineJoin: 'round',
            opacity: dynamicOpacity
        });
        currentLine.add(segment);
    } else if (shapeMode === 'airbrush') {
        for (let i = 0; i < 7; i++) {
            let offsetX = (Math.random() - 0.5) * strokeWidth * 5;
            let offsetY = (Math.random() - 0.5) * strokeWidth * 5;
            let dot = new Konva.Circle({
                x: pos.x + offsetX,
                y: pos.y + offsetY,
                radius: 0.5,
                fill: isEraser ? "#FFFFFF" : strokeColor,
            });
            currentLine.add(dot);
        }
    }   

    lastPos = pos;
    layer.batchDraw();
});

stage.on('pointerup', async (event) => {
    event.evt.preventDefault();
    if (isScaling) {
        isScaling = false;
        return; 
    }
    if (!isDrawing) return;
    isDrawing = false;

    let drawingData = {
        userid: sessionStorage.getItem('userId'),
        sessionid: sessionId,
        color: isEraser ? "#FFFFFF" : strokeColor,
        thickness: parseInt(strokeWidth),
        shapeType: shapeMode || "line",
        opacity: opacity,
        zIndex: getNextZIndex()
    };

    if (shapeMode === 'straightline') {
        drawingData.points = currentLine.points();
    } else if (shapeMode === 'rectangle' || shapeMode === 'square') {
        drawingData.points = [
            currentLine.x(),
            currentLine.y(),
            currentLine.x() + currentLine.width(),
            currentLine.y() + currentLine.height()
        ];
    } else if (shapeMode === 'ellipse') {
        drawingData.points = [
            currentLine.x() - currentLine.radiusX(),
            currentLine.y() - currentLine.radiusY(),
            currentLine.x() + currentLine.radiusX(),
            currentLine.y() + currentLine.radiusY(),
        ];
    } else if (shapeMode === 'pen') {
        drawingData.points = [];
        
        if (currentLine.getChildren().length === 0) {
            console.warn("Нет сегментов в currentLine!");
        }

        currentLine.getChildren().forEach(seg => {
            let pts = seg.points();
            drawingData.points.push(seg.strokeWidth(), ...pts);
        });

    } else if (shapeMode === 'airbrush') {
        drawingData.points = currentLine.getChildren().flatMap(dot =>
            [dot.x(), dot.y()]);
    } else if (shapeMode === 'pencil') {
        drawingData.points = currentLine.points();
    }

    try {
        console.log("Отправка данных:", drawingData);
        await sendDrawingData(drawingData, 1000);
        redoStack = [];
    } catch (err) {
        console.error("Ошибка отправки данных:", err);
    }

});

async function sendDrawingData(drawingData, chunkSize) {
    if (drawingData.points.length <= chunkSize) {
        try {
            console.log("Отправка всех данных за раз:", drawingData);
            let id = await connection.invoke("SendDrawingData", sessionId, drawingData);
            currentLine.id(id); 
            history.push({ id: id, shape: currentLine, shapeType: drawingData.shapeType, points: drawingData.points, zIndex: drawingData.zIndex });
        } catch (err) {
            console.error("Ошибка отправки данных за раз:", err);
        }
    } else {
        await sendDataInChunks(drawingData, 1000);
    }
}

async function sendDataInChunks(drawingData, chunkSize = 1000) {
    let chunks = [];
    for (let i = 0; i < drawingData.points.length; i += chunkSize) {
        chunks.push(drawingData.points.slice(i, i + chunkSize));
    }
    let currentId = null; 
    try {
        let firstChunkData = {
            ...drawingData,
            points: chunks[0]  
        };
        currentId = await connection.invoke("SendDrawingData", sessionId, firstChunkData);
        currentLine.id(currentId);  
        history.push({ id: currentId, shape: currentLine, shapeType: drawingData.shapeType, points: firstChunkData.points, zIndex: drawingData.zIndex });
        console.log(`Получен id для первой части: ${currentId}`);
    } catch (err) {
        console.error("Ошибка при отправке первой части:", err);
        return;
    }

    for (let i = 1; i < chunks.length; i++) {
        try {
            let chunkData = {
                ...drawingData,
                points: chunks[i],
                id: currentId  
            };
            console.log(`Отправка части ${i + 1}/${chunks.length}:`, chunkData);
            await connection.invoke("SendDrawingData", sessionId, chunkData);
        } catch (err) {
            console.error(`Ошибка при отправке части ${i + 1}:`, err);
        }
    }
}

document.getElementById('undo').addEventListener('click', () => {
    if (history.length === 0) return;

    let lastShape = history.pop();
    redoStack.push(lastShape);

    let shape = layer.findOne(`#${lastShape.id}`);
    if (shape) {
        shape.destroy();
        layer.batchDraw();
    }

    connection.invoke("SendUndo", sessionId, lastShape.id)
        .catch(err => console.error("Ошибка отмены:", err));
});

document.getElementById('redo').addEventListener('click', () => {
    if (redoStack.length === 0) return;

    let shapeData = redoStack.pop();
    let restoredShape;

    switch (shapeData.shapeType) {
        case "straightline":
            restoredShape = new Konva.Line({
                id: shapeData.id,
                stroke: shapeData.shape.getAttr('stroke'),
                strokeWidth: parseFloat(shapeData.shape.getAttr('strokeWidth')),
                points: shapeData.points,
                lineCap: 'round',
                lineJoin: 'round',
                opacity: parseFloat(shapeData.shape.getAttr('opacity')),
                zIndex: shapeData.zIndex,
            });
            break;
        case "rectangle":
            restoredShape = new Konva.Rect({
                id: shapeData.id,
                x: shapeData.points[0],
                y: shapeData.points[1],
                width: shapeData.points[2] - shapeData.points[0],
                height: shapeData.points[3] - shapeData.points[1],
                stroke: shapeData.shape.getAttr('stroke'),
                strokeWidth: parseFloat(shapeData.shape.getAttr('strokeWidth')),
                opacity: parseFloat(shapeData.shape.getAttr('opacity')),
                zIndex: shapeData.zIndex,
            });
            break;
        case "square":
            let side = Math.min(Math.abs(shapeData.points[2] - shapeData.points[0]), Math.abs(shapeData.points[3] - shapeData.points[1]));
            restoredShape = new Konva.Rect({
                id: shapeData.id,
                x: shapeData.points[0],
                y: shapeData.points[1],
                width: side,
                height: side,
                stroke: shapeData.shape.getAttr('stroke'),
                strokeWidth: parseFloat(shapeData.shape.getAttr('strokeWidth')),
                opacity: parseFloat(shapeData.shape.getAttr('opacity')),
                zIndex: shapeData.zIndex,
            });
            break;
        case "ellipse":
            restoredShape = new Konva.Ellipse({
                id: shapeData.id,
                x: (shapeData.points[0] + shapeData.points[2]) / 2,
                y: (shapeData.points[1] + shapeData.points[3]) / 2,
                radiusX: Math.abs(shapeData.points[2] - shapeData.points[0]) / 2,
                radiusY: Math.abs(shapeData.points[3] - shapeData.points[1]) / 2,
                stroke: shapeData.shape.getAttr('stroke'),
                strokeWidth: parseFloat(shapeData.shape.getAttr('strokeWidth')),
                opacity: parseFloat(shapeData.shape.getAttr('opacity')),                
                zIndex: shapeData.zIndex,
            });
            break;
        case "pen":
            restoredShape = new Konva.Group({ id: shapeData.id });
            let points = shapeData.points;

            for (let i = 0; i < points.length; i += 5) {
                let width = points[i];
                let segment = new Konva.Line({
                    stroke: shapeData.shape.getAttr('stroke'),
                    strokeWidth: width,
                    points: [points[i + 1], points[i + 2], points[i + 3], points[i + 4]],
                    lineCap: 'round',
                    lineJoin: 'round',
                    opacity: parseFloat(shapeData.shape.getAttr('opacity')),
                    zIndex: shapeData.zIndex,
                });
                restoredShape.add(segment);
            }
            break;
        case "airbrush":
            restoredShape = new Konva.Group({id: shapeData.id });
            for (let i = 0; i < shapeData.points.length; i += 2) {
                let dot = new Konva.Circle({
                    x: shapeData.points[i],
                    y: shapeData.points[i + 1],
                    radius: 0.5,
                    fill: shapeData.shape.getAttr('stroke'),
                    opacity: parseFloat(shapeData.shape.getAttr('opacity')),
                    zIndex: shapeData.zIndex,
                });
                restoredShape.add(dot);
            }
            break;
        case "pencil":
            restoredShape = new Konva.Line({
                id: shapeData.id,
                stroke: shapeData.shape.getAttr('stroke'),
                strokeWidth: parseFloat(shapeData.shape.getAttr('strokeWidth')),
                points: shapeData.points,
                lineCap: 'round',
                lineJoin: 'round',
                opacity: parseFloat(shapeData.shape.getAttr('opacity')),
                zIndex: shapeData.zIndex,
            });            
    }

    console.log(restoredShape);
    history.push({ id: shapeData.id, shape: restoredShape, shapeType: shapeData.shapeType });
    layer.add(restoredShape);
    layer.batchDraw();

    connection.invoke("SendRedo", sessionId, {
        id: shapeData.id,
        shapeType: shapeData.shapeType,
        points: shapeData.points,
        color: shapeData.shape.getAttr('stroke'),
        thickness: parseFloat(shapeData.shape.getAttr('strokeWidth')), 
        userid: sessionStorage.getItem('userId'),
        opacity: parseFloat(shapeData.shape.getAttr('opacity')),
        zIndex: shapeData.zIndex,
    }).catch(err => console.error("Ошибка повтора:", err));
});

stage.on('click', () => {
    if (!isTextMode) return; 

    const pos = stage.getPointerPosition();
    const textValue = prompt("Введите текст:");

    if (!textValue) {
        isTextMode = false;  
        return;
    }
    const textNode = new Konva.Text({
        x: pos.x,
        y: pos.y,
        text: textValue,
        fontSize: 20,
        fontFamily: 'Arial',
        fill: strokeColor, 
        draggable: true,
        userid: sessionStorage.getItem('userId'),
    });

    layer.add(textNode);
    layer.batchDraw();

    textButton.classList.remove("active");
    textButton.classList.remove("text-active");

    connection.invoke("SendTextData", sessionId, {
        x: pos.x,
        y: pos.y,
        text: textValue,
        color: strokeColor,
        sessionid: sessionId,
        userid: sessionStorage.getItem('userId'),
        zIndex: getNextZIndex(),
    }).then(id => {
        textNode.id(id);
    }).catch(err => console.error("Ошибка отправки текста:", err));

    textNode.on('dragend', () => {
        console.log("MoveTextData");
        connection.invoke("MoveTextData", sessionId, {
            id: textNode.id(),
            x: textNode.x(),
            y: textNode.y()
        }).catch(err => console.error("Ошибка перемещения текста:", err));
    });

    let longPressTimeout;

    function startLongPress() {
        cancelLongPress();
        longPressTimeout = setTimeout(() => {
            showTextMenu(textNode);
        }, 500); 
    }

    function cancelLongPress() {
        clearTimeout(longPressTimeout);
    }

    textNode.on('mousedown', startLongPress);
    textNode.on('mouseup', cancelLongPress);
    textNode.on('mouseout', cancelLongPress);

    textNode.on('dragstart', cancelLongPress);

    textNode.on('touchstart', startLongPress);
    textNode.on('touchend', cancelLongPress);
    textNode.on('touchmove', cancelLongPress);
});

function showTextMenu(textNode) {
    const userId = sessionStorage.getItem('userId');
    connection.invoke("LockElement", sessionId, textNode.id(), userId)
        .then(isLocked => {
            if (!isLocked) {
                alert("Текст редактируется пользователем");
                return;
            }

    selectedTextNode = textNode;

    const textMenu = document.getElementById("textMenu");
    const containerRect = stage.container().getBoundingClientRect();
    const scale = stage.scaleX();
    const pos = stage.position();
    const absX = textNode.x() * scale + pos.x;
    const absY = textNode.y() * scale + pos.y;
    const menuWidth = 200;
    const screenW = window.innerWidth;

    textMenu.style.display = "block";
    textMenu.style.position = "absolute";
    textMenu.style.zIndex = "9999";

    if (screenW <= 768) {
        textMenu.style.left = '50%';
        textMenu.style.top = '50%';
        textMenu.style.transform = 'translate(-50%, -50%)';
    } else {
        let left = containerRect.left + absX + textNode.width() * scale + 10;
        if (left + menuWidth > screenW) {
            left = containerRect.left + absX - menuWidth - 10;
        }

        textMenu.style.left = `${left}px`;
        textMenu.style.top = `${containerRect.top + absY}px`;
        textMenu.style.transform = ''; 
    }

    document.getElementById("textValue").value = textNode.text();
    document.getElementById("textSize").value = textNode.fontSize();
    document.getElementById("textFont").value = textNode.fontFamily();
    document.getElementById("textColor").value = textNode.fill();
    })
    .catch(err => {
       console.error("Ошибка блокировки текста:", err);
    });
}

document.getElementById('closeEditButton').addEventListener('click', () => {
    document.getElementById('textMenu').style.display = 'none';
    connection.invoke("UnlockElement", sessionId, selectedTextNode.id(), userId)
        .catch(console.error);
});

document.getElementById("updateText").addEventListener("click", () => {
    if (!selectedTextNode) return;
    connection.invoke("UnlockElement", sessionId, selectedTextNode.id(), userId)
        .catch(console.error);

    selectedTextNode.text(document.getElementById("textValue").value);
    selectedTextNode.fontSize(parseInt(document.getElementById("textSize").value));
    selectedTextNode.fontFamily(document.getElementById("textFont").value);
    selectedTextNode.fill(document.getElementById("textColor").value);

    layer.batchDraw();

    connection.invoke("UpdateTextData", sessionId, {
        id: selectedTextNode.id(),
        text: selectedTextNode.text(),
        fontSize: selectedTextNode.fontSize(),
        fontFamily: selectedTextNode.fontFamily(),
        color: selectedTextNode.fill(),
        x: selectedTextNode.x(),
        y: selectedTextNode.y(),
        zIndex: selectedTextNode.zIndex(),
    }).catch(err => console.error("Ошибка обновления текста:", err));

    document.getElementById("textMenu").style.display = "none";
});

document.getElementById("deleteText").addEventListener("click", () => {
    if (!selectedTextNode) return;

    connection.invoke("DeleteTextData", sessionId, { id: selectedTextNode.id() })
        .catch(err => console.error("Ошибка удаления текста:", err));

    selectedTextNode.destroy();
    layer.batchDraw();
    document.getElementById("textMenu").style.display = "none";
});

document.getElementById("insertImage").addEventListener("click", function () {
    document.getElementById("imageLoader").click();
});

document.getElementById("imageLoader").addEventListener("change", async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const serverIp = "192.168.1.103"; 
    const serverPort = 5116;
    const serverUrl = `http://${serverIp}:${serverPort}`;

    let response = await fetch(`${serverUrl}/session/upload-image`, {
        method: "POST",
        body: formData
    });

    const { url } = await response.json(); 
    const fullUrl = `${serverUrl}${url}`;

    const imageObj = new Image();
    imageObj.src = fullUrl;

    imageObj.onload = function () {
        addImageToCanvas(imageObj, fullUrl);
    };
});

function addImageToCanvas(imageObj, url) {
    const konvaImage = new Konva.Image({
        image: imageObj,
        x: 50,  
        y: 50,
        width: imageObj.width / 3,  
        height: imageObj.height / 3,
        draggable: false,
        name: 'image',
        userid: sessionStorage.getItem('userId'),
    });

    let longPressTimeout;

    function startLongPress() {
        longPressTimeout = setTimeout(() => {
            enableEditing(konvaImage);
        }, 500);
    }

    function cancelLongPress() {
        clearTimeout(longPressTimeout);
    }

    konvaImage.on('mousedown', startLongPress);
    konvaImage.on('mouseup', cancelLongPress);
    konvaImage.on('mouseout', cancelLongPress);

    konvaImage.on('dragstart', cancelLongPress);

    konvaImage.on('touchstart', startLongPress);
    konvaImage.on('touchend', cancelLongPress);
    konvaImage.on('touchmove', cancelLongPress);

    konvaImage.on('dragend', () => {
        console.log(`Изображение перемещено: ${konvaImage.id()} на позицию (${konvaImage.x()}, ${konvaImage.y()})`);
        connection.invoke("MoveImageData", sessionId, {
            id: konvaImage.id(),
            x: konvaImage.x(),
            y: konvaImage.y()
        }).catch(err => console.error("Ошибка перемещения изображения:", err));
    });

    konvaImage.on('transformend', () => {
        const newWidth = konvaImage.width() * konvaImage.scaleX();
        const newHeight = konvaImage.height() * konvaImage.scaleY();
        const newRotation = konvaImage.rotation();

        const centerX = konvaImage.x() + newWidth / 2;
        const centerY = konvaImage.y() + newHeight / 2;

        konvaImage.width(newWidth);
        konvaImage.height(newHeight);
        konvaImage.scaleX(1);
        konvaImage.scaleY(1);

        konvaImage.x(centerX - newWidth / 2);
        konvaImage.y(centerY - newHeight / 2);

        connection.invoke("ResizeImageData", sessionId, {
            id: konvaImage.id(),
            x: konvaImage.x(),
            y: konvaImage.y(),
            width: konvaImage.width(),
            height: konvaImage.height(),
            rotation: newRotation
        }).catch(err => console.error("Ошибка изменения размера изображения:", err));
    });

    connection.invoke("SendImageData", sessionId, {
        sessionid: sessionId,
        userid: sessionStorage.getItem('userId'),
        url: url,
        x: konvaImage.x(),
        y: konvaImage.y(),
        width: konvaImage.width(),
        height: konvaImage.height(),
        zIndex: getNextZIndex() 
    }).then(id => {
        konvaImage.id(id);
    }).catch(err => console.error("Ошибка отправки изображения:", err));

    layer.add(konvaImage);
    layer.draw();
}

function enableEditing(konvaImage) {
    const userId = sessionStorage.getItem('userId');
    connection.invoke("LockElement", sessionId, konvaImage.id(), userId)
        .then(isLocked => {
            if (isLocked) {
                startEditing(konvaImage); 
            } else {
                alert("Изображение редактируется пользователем");
            }
        });
}
function startEditing(konvaImage) {

    if (selectedImage && selectedImage !== konvaImage) {
        disableEditing(); 
    }
    selectedImage = konvaImage;

    konvaImage.draggable(true);
    if (transformer) {
        transformer.destroy();
    }
    transformer = new Konva.Transformer({
        nodes: [konvaImage],
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
    });
    layer.add(transformer);
    layer.draw();

    showImageMenu();
}

function showImageMenu() {
    const imageMenu = document.getElementById('imageMenu');
    imageMenu.style.display = 'block';

    if (window.innerWidth <= 768) {
        imageMenu.style.left = '50%';
        imageMenu.style.top = '50%';
        imageMenu.style.transform = 'translate(-50%, -50%)';
    } else {
        const stageBox = stage.container().getBoundingClientRect();
        const scale = stage.scaleX();
        const pos = stage.position();

        const imageX = selectedImage.x() * scale + pos.x;
        const imageY = selectedImage.y() * scale + pos.y;

        const menuWidth = 160;
        const screenW = window.innerWidth;

        let left = stageBox.left + imageX + selectedImage.width() * scale + 10;
        if (left + menuWidth > screenW) {
            left = stageBox.left + imageX - menuWidth - 10;
        }

        imageMenu.style.left = `${left}px`;
        imageMenu.style.top = `${stageBox.top + imageY}px`;
        imageMenu.style.transform = ''; 
    }

    document.getElementById("deleteImageButton").onclick = () => {
        connection.invoke("DeleteImageData", sessionId, {
            id: selectedImage.id()
        }).catch(err => console.error("Ошибка удаления изображения:", err));
        selectedImage.destroy();
        disableEditing();
    };

    document.getElementById("closeImageEditButton").onclick = disableEditing;

    document.getElementById("bringForwardButton").onclick = () => {
        moveImageForward();
    };
    document.getElementById("sendBackwardButton").onclick = () => {
        moveImageBackward();
    };

    document.getElementById("bringToFrontButton").onclick = () => {
        bringImageToFront();
    };
    document.getElementById("sendToBackButton").onclick = () => {
        sendImageToBack();
    };
}

function moveImageForward() {
    if (!selectedImage) return;
    selectedImage.moveUp();
    layer.draw();
    sendZIndexUpdate(selectedImage);
}

function moveImageBackward() {
    if (!selectedImage) return;
    selectedImage.moveDown();
    layer.draw();
    sendZIndexUpdate(selectedImage);
}

function bringImageToFront() {
    if (!selectedImage) return;
    selectedImage.moveToTop();
    layer.draw();
    sendZIndexUpdate(selectedImage);
}

function sendImageToBack() {
    if (!selectedImage) return;
    selectedImage.moveToBottom();
    layer.draw();
    sendZIndexUpdate(selectedImage);
}

function sendZIndexUpdate(imageNode) {
    connection.invoke("UpdateImageZIndex", sessionId, {
        id: imageNode.id(),
        zIndex: imageNode.getZIndex()
    }).catch(err => console.error("Ошибка обновления Z-индекса:", err));
}

function disableEditing() {
    if (!selectedImage) return;

    const userId = sessionStorage.getItem('userId');
    connection.invoke("UnlockElement", sessionId, selectedImage.id(), userId)
        .catch(err => console.error("Ошибка снятия блокировки:", err));

    if (transformer) {
        transformer.destroy();
        transformer = null;
    }

    selectedImage.draggable(false);
    selectedImage = null;

    document.getElementById('imageMenu').style.display = 'none';
    layer.draw();
}

function exportImage() {
    const dataURL = stage.toDataURL({
        pixelRatio: 2,
    });

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'stage-image.png';
    link.click();
}

function getNextZIndex() {
    let maxZIndex = Math.max(...layer.getChildren().map(el => el.zIndex() || 0), 0);
    return maxZIndex + 1;
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 'z' || e.key === 'я')) {
        document.getElementById('undo').click();
        console.log('Отмена');
    } else if (e.ctrlKey && (e.key === 'y' || e.key === 'н')) {
        document.getElementById('redo').click();
        console.log('Повтор');
    }
});

stage.on('wheel', (e) => {
    e.evt.preventDefault();
    let scaleBy = 1.05;
    let oldScale = stage.scaleX();
    let pointer = stage.getPointerPosition();
    let newScale = Math.min(Math.max(oldScale * (e.evt.deltaY > 0 ? 1 / scaleBy : scaleBy), minScale), maxScale);
    stage.scale({ x: newScale, y: newScale });

    let newPos = {
        x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
        y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale),
    };

    stage.position(newPos);
    stage.batchDraw();
});

let ctrlPressed = false;
let isScaling = false;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Control') {
        ctrlPressed = true;
    }
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'Control') {
        ctrlPressed = false;
        isScaling = false;
    }
});

stage.on('pointermove', (e) => {
    if (ctrlPressed && isScaling) {
        isDrawing = false;
        let scaleBy = 1.05;
        let oldScale = stage.scaleX();
        let pointer = stage.getPointerPosition();
        let delta = e.evt.movementY || e.evt.movementX;
        if (!delta) return;
        let newScale = Math.min(
            Math.max(oldScale * (delta > 0 ? 1 / scaleBy : scaleBy), minScale),
            maxScale
        );
        stage.scale({ x: newScale, y: newScale });

        let newPos = {
            x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
            y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale),
        };

        stage.position(newPos);
        stage.batchDraw();
    }
});

let lastTouchDist = 0;
let lastTouchCenter = null;
let isPinching = false;

stage.getContent().addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        isPinching = true;
        isDrawing = false;

        lastTouchDist = getTouchDist(e.touches);
        lastTouchCenter = getTouchCenter(e.touches);
    }
});

stage.getContent().addEventListener('touchmove', (e) => {
    if (isPinching && e.touches.length === 2) {
        e.preventDefault();

        const newTouchDist = getTouchDist(e.touches);
        const newTouchCenter = getTouchCenter(e.touches);

        const scaleBy = newTouchDist / lastTouchDist;
        const oldScale = stage.scaleX();
        let newScale = oldScale * scaleBy;
        newScale = Math.min(Math.max(newScale, minScale), maxScale);

        const stageBox = stage.container().getBoundingClientRect();
        const pointer = {
            x: newTouchCenter.x - stageBox.left,
            y: newTouchCenter.y - stageBox.top,
        };

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };

        const dx = newTouchCenter.x - lastTouchCenter.x;
        const dy = newTouchCenter.y - lastTouchCenter.y;

        newPos.x += dx;
        newPos.y += dy;

        stage.position(newPos);
        stage.batchDraw();

        lastTouchDist = newTouchDist;
        lastTouchCenter = newTouchCenter;
    }
});

stage.getContent().addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
        isPinching = false;
        isDrawing = true;
    }
});

function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
    };
}

setInterval(() => {
    if (connection && connection?.state === "Connected") {
        connection.invoke("PingSession", sessionId, userId)
            .catch(console.error);
    }
}, 10000); 
