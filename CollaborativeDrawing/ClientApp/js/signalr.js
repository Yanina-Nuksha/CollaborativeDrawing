const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');

const connection = new signalR.HubConnectionBuilder()
    .withUrl(`http://${window.location.hostname}:5116/drawingHub?sessionId=${sessionId}`, { withCredentials: false })
    .build();

connection.start().then(() => {
    console.log("Connected to drawing hub");

    let username = sessionStorage.getItem('username');
    let userId = sessionStorage.getItem('userId');

    console.log("user: " + userId);

    if (sessionId && username) {
        connection.invoke("NotifyUserJoined", sessionId, username)
            .catch(err => console.error("Ошибка отправки уведомления:", err));
    }

    connection.invoke("JoinSession", sessionId, userId);
    fetchSessionUsers();
}).catch(err => console.error("Connection to drawing hub failed:", err));

connection.on("ReceiveDrawingData", (drawingData) => {
    console.log("Получение данных от сервера:", drawingData);

    let receivedShape;

    switch (drawingData.shapeType) {
        case "straightline":
            receivedShape = new Konva.Line({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userId,
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                points: drawingData.points,
                lineCap: 'round',
                lineJoin: 'round',
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
            break;
        case "rectangle":
            receivedShape = new Konva.Rect({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userId,
                x: drawingData.points[0],
                y: drawingData.points[1],
                width: drawingData.points[2] - drawingData.points[0],
                height: drawingData.points[3] - drawingData.points[1],
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
            break;
        case "square":
            let side = Math.min(Math.abs(drawingData.points[2] - drawingData.points[0]), Math.abs(drawingData.points[3] - drawingData.points[1]));
            receivedShape = new Konva.Rect({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userId,
                x: drawingData.points[0],
                y: drawingData.points[1],
                width: side,
                height: side,
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
            break;
        case "ellipse":
            receivedShape = new Konva.Ellipse({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userId,
                x: (drawingData.points[0] + drawingData.points[2]) / 2,
                y: (drawingData.points[1] + drawingData.points[3]) / 2,
                radiusX: Math.abs(drawingData.points[2] - drawingData.points[0]) / 2,
                radiusY: Math.abs(drawingData.points[3] - drawingData.points[1]) / 2,
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
            break;
        case "pen":
            receivedShape = new Konva.Group({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userId,
            });
            let points = drawingData.points;

            for (let i = 0; i < points.length; i += 5) {
                let width = points[i];
                let segment = new Konva.Line({
                    stroke: drawingData.color,
                    strokeWidth: width,
                    points: [points[i + 1], points[i + 2], points[i + 3], points[i + 4]],
                    lineCap: 'round',
                    lineJoin: 'round',
                    opacity: drawingData.opacity,
                    zIndex: drawingData.zIndex,
                });
                receivedShape.add(segment);
            }
            break;
        case "airbrush":
            receivedShape = new Konva.Group({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userId,
            });
            for (let i = 0; i < drawingData.points.length; i += 2) {
                let dot = new Konva.Circle({
                    x: drawingData.points[i],
                    y: drawingData.points[i + 1],
                    radius: 0.5,
                    fill: drawingData.color,
                    opacity: drawingData.opacity,
                    zIndex: drawingData.zIndex,
                });
                receivedShape.add(dot);
            }
            break;
        case "pencil":
            receivedShape = new Konva.Line({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userId,
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                points: drawingData.points,
                lineCap: 'round',
                lineJoin: 'round',
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
    }

    layer.add(receivedShape);
    layer.batchDraw();
});

function loadImages(existingImages) {
    return Promise.all(existingImages.map(imageData => {
        return new Promise(resolve => {
            let image = new Image();
            image.src = imageData.src;
            image.onload = () => {
                resolve({
                    type: "image",
                    data: { ...imageData, image: image },
                    zIndex: imageData.zIndex
                });
            };
        });
    }));
}

connection.on("LoadExistingData", (existingDrawings, existingTexts, existingImages) => {
    const allElements = [];
    let imagesLoaded = 0; 

    existingDrawings.forEach(drawingData => {
        allElements.push({
            type: "drawing",
            data: drawingData,
            zIndex: drawingData.zIndex
        });
    });  
    
    existingTexts.forEach(textData => {
        allElements.push({
            type: "text",
            data: textData,
            zIndex: textData.zIndex
        });
    });

    if (existingImages.length === 0) {
        renderElements(allElements);
        return;  
    }

    existingImages.forEach(imageData => {
        let image = new Image();
        image.src = imageData.url;
        image.onload = function () {
            allElements.push({
                type: "image",
                data: { ...imageData, image: image },
                zIndex: imageData.zIndex
            });
            imagesLoaded++;
            if (imagesLoaded === existingImages.length) {
                renderElements(allElements);
            }
        };
    });

    function renderElements(elements) {

        elements.sort((a, b) => a.zIndex - b.zIndex);

        console.log("allElements:", elements);

        elements.forEach(el => {
            let konvaElement;
            if (el.type === "drawing") {
                let drawingData = el.data;
                switch (drawingData.shapeType) {
                    case "straightline":
                        konvaElement = new Konva.Line({
                            id: drawingData.id,
                            sessionid: drawingData.sessionId,
                            userid: drawingData.userId,
                            stroke: drawingData.color,
                            strokeWidth: drawingData.thickness,
                            points: drawingData.points,
                            lineCap: 'round',
                            lineJoin: 'round',
                            opacity: drawingData.opacity,
                        });
                        break;
                    case "rectangle":
                        konvaElement = new Konva.Rect({
                            id: drawingData.id,
                            sessionid: drawingData.sessionId,
                            userid: drawingData.userId,
                            x: drawingData.points[0],
                            y: drawingData.points[1],
                            width: drawingData.points[2] - drawingData.points[0],
                            height: drawingData.points[3] - drawingData.points[1],
                            stroke: drawingData.color,
                            strokeWidth: drawingData.thickness,
                            opacity: drawingData.opacity,
                        });
                        break;
                    case "square":
                        let side = Math.min(Math.abs(drawingData.points[2] - drawingData.points[0]), Math.abs(drawingData.points[3] - drawingData.points[1]));
                        konvaElement = new Konva.Rect({
                            id: drawingData.id,
                            sessionid: drawingData.sessionId,
                            userid: drawingData.userId,
                            x: drawingData.points[0],
                            y: drawingData.points[1],
                            width: side,
                            height: side,
                            stroke: drawingData.color,
                            strokeWidth: drawingData.thickness,
                            opacity: drawingData.opacity,
                        });
                        break;
                    case "ellipse":
                        konvaElement = new Konva.Ellipse({
                            id: drawingData.id,
                            sessionid: drawingData.sessionId,
                            userid: drawingData.userId,
                            x: (drawingData.points[0] + drawingData.points[2]) / 2,
                            y: (drawingData.points[1] + drawingData.points[3]) / 2,
                            radiusX: Math.abs(drawingData.points[2] - drawingData.points[0]) / 2,
                            radiusY: Math.abs(drawingData.points[3] - drawingData.points[1]) / 2,
                            stroke: drawingData.color,
                            strokeWidth: drawingData.thickness,
                            opacity: drawingData.opacity,
                        });
                        break;
                    case "pen":
                        konvaElement = new Konva.Group({
                            id: drawingData.id,
                            sessionid: drawingData.sessionId,
                            userid: drawingData.userId,
                        });
                        let points = drawingData.points;

                        for (let i = 0; i < points.length; i += 5) {
                            let width = points[i];
                            let segment = new Konva.Line({
                                stroke: drawingData.color,
                                strokeWidth: width,
                                points: [points[i + 1], points[i + 2], points[i + 3], points[i + 4]],
                                lineCap: 'round',
                                lineJoin: 'round',
                                opacity: drawingData.opacity,
                            });
                            konvaElement.add(segment);
                        }
                        break;
                    case "airbrush":
                        konvaElement = new Konva.Group({
                            id: drawingData.id,
                            sessionid: drawingData.sessionId,
                            userid: drawingData.userId,
                        });
                        for (let i = 0; i < drawingData.points.length; i += 2) {
                            let dot = new Konva.Circle({
                                x: drawingData.points[i],
                                y: drawingData.points[i + 1],
                                radius: 0.5,
                                fill: drawingData.color,
                                opacity: drawingData.opacity,
                            });
                            konvaElement.add(dot);
                        }
                        break;
                    case "pencil":
                        konvaElement = new Konva.Line({
                            id: drawingData.id,
                            sessionid: drawingData.sessionId,
                            userid: drawingData.userId,
                            stroke: drawingData.color,
                            strokeWidth: drawingData.thickness,
                            points: drawingData.points,
                            lineCap: 'round',
                            lineJoin: 'round',
                            opacity: drawingData.opacity,
                        });
                }
            }
            else if (el.type === "text") {
                let textData = el.data;
                konvaElement = new Konva.Text({
                    id: textData.id,
                    sessionid: textData.sessionId,
                    userid: textData.userId,
                    x: textData.x,
                    y: textData.y,
                    text: textData.text,
                    fontSize: 20,
                    fontFamily: 'Arial',
                    fill: textData.color,
                    draggable: true,
                });
                konvaElement.on('dragend', () => {
                    console.log("Текст отпущен:", konvaElement.x(), konvaElement.y());

                    connection.invoke("MoveTextData", sessionId, {
                        id: konvaElement.id(),
                        x: konvaElement.x(),
                        y: konvaElement.y()
                    }).catch(err => console.error("Ошибка перемещения текста:", err));
                });

                let longPressTimeout;

                function startLongPress() {
                    longPressTimeout = setTimeout(() => {
                        showTextMenu(konvaElement);
                    }, 500);
                }

                function cancelLongPress() {
                    clearTimeout(longPressTimeout);
                }
                konvaElement.on('mousedown', startLongPress);
                konvaElement.on('mouseup', cancelLongPress);
                konvaElement.on('mouseout', cancelLongPress);

                konvaElement.on('dragstart', cancelLongPress);

                konvaElement.on('touchstart', startLongPress);
                konvaElement.on('touchend', cancelLongPress);
                konvaElement.on('touchmove', cancelLongPress);
            }
            else if (el.type === "image") {
                let imageData = el.data;

                konvaElement = new Konva.Image({
                    id: imageData.id,
                    sessionid: imageData.sessionId,
                    userid: imageData.userId,
                    image: imageData.image,
                    x: imageData.x,
                    y: imageData.y,
                    width: imageData.width,
                    height: imageData.height,
                    draggable: false,
                    rotation: imageData.rotation,
                    name: 'image',
                });

                let longPressTimeout;

                function startLongPress() {
                    longPressTimeout = setTimeout(() => {
                        enableEditing(konvaElement);
                    }, 500);
                }

                function cancelLongPress() {
                    clearTimeout(longPressTimeout);
                }

                konvaElement.on('mousedown', startLongPress);
                konvaElement.on('mouseup', cancelLongPress);
                konvaElement.on('mouseout', cancelLongPress);

                konvaElement.on('dragstart', cancelLongPress);

                konvaElement.on('touchstart', startLongPress);
                konvaElement.on('touchend', cancelLongPress);
                konvaElement.on('touchmove', cancelLongPress);

                konvaElement.on('dragend', () => {
                    connection.invoke("MoveImageData", sessionId, {
                        id: konvaElement.id(),
                        x: konvaElement.x(),
                        y: konvaElement.y()
                    }).catch(err => console.error("Ошибка перемещения изображения:", err));
                });

                konvaElement.on('transformend', () => {
                    const newWidth = konvaElement.width() * konvaElement.scaleX();
                    const newHeight = konvaElement.height() * konvaElement.scaleY();
                    const newRotation = konvaElement.rotation();

                    const centerX = konvaElement.x() + newWidth / 2;
                    const centerY = konvaElement.y() + newHeight / 2;

                    konvaElement.width(newWidth);
                    konvaElement.height(newHeight);
                    konvaElement.scaleX(1);
                    konvaElement.scaleY(1);

                    konvaElement.x(centerX - newWidth / 2);
                    konvaElement.y(centerY - newHeight / 2);

                    connection.invoke("ResizeImageData", sessionId, {
                        id: konvaElement.id(),
                        x: konvaElement.x(),
                        y: konvaElement.y(),
                        width: konvaElement.width(),
                        height: konvaElement.height(),
                        rotation: newRotation
                    }).catch(err => console.error("Ошибка изменения размера изображения:", err));
                });
            }
            layer.add(konvaElement);
        });

        layer.batchDraw();
    }
});

connection.on("ReceiveUndo", (id) => {
    console.log("Удаление объекта с ID:", id);

    let shape = layer.findOne(`#${id}`);
    if (shape) {
        shape.destroy();
        layer.batchDraw();
    }
});

connection.on("ReceiveRedo", (drawingData) => {
    console.log("Получение повтора с сервера:", drawingData);

    let receivedShape;

    switch (drawingData.shapeType) {
        case "straightline":
            receivedShape = new Konva.Line({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userid,
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                points: drawingData.points,
                lineCap: 'round',
                lineJoin: 'round',
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
            break;
        case "rectangle":
            receivedShape = new Konva.Rect({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userid,
                x: drawingData.points[0],
                y: drawingData.points[1],
                width: drawingData.points[2] - drawingData.points[0],
                height: drawingData.points[3] - drawingData.points[1],
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
            break;
        case "square":
            let side = Math.min(Math.abs(drawingData.points[2] - drawingData.points[0]), Math.abs(drawingData.points[3] - drawingData.points[1]));
            receivedShape = new Konva.Rect({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userid,
                x: drawingData.points[0],
                y: drawingData.points[1],
                width: side,
                height: side,
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
            break;
        case "ellipse":
            receivedShape = new Konva.Ellipse({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userid,
                x: (drawingData.points[0] + drawingData.points[2]) / 2,
                y: (drawingData.points[1] + drawingData.points[3]) / 2,
                radiusX: Math.abs(drawingData.points[2] - drawingData.points[0]) / 2,
                radiusY: Math.abs(drawingData.points[3] - drawingData.points[1]) / 2,
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
            break;
        case "pen":
            receivedShape = new Konva.Group({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userid,
            });
            let points = drawingData.points;

            for (let i = 0; i < points.length; i += 5) {
                let width = points[i];
                let segment = new Konva.Line({
                    stroke: drawingData.color,
                    strokeWidth: width,
                    points: [points[i + 1], points[i + 2], points[i + 3], points[i + 4]],
                    lineCap: 'round',
                    lineJoin: 'round',
                    opacity: drawingData.opacity,
                    zIndex: drawingData.zIndex,
                });
                receivedShape.add(segment);
            }
            break;
        case "airbrush":
            receivedShape = new Konva.Group({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userid,
            });
            for (let i = 0; i < drawingData.points.length; i += 2) {
                let dot = new Konva.Circle({
                    x: drawingData.points[i],
                    y: drawingData.points[i + 1],
                    radius: 0.5,
                    fill: drawingData.color,
                    opacity: drawingData.opacity,
                    zIndex: drawingData.zIndex,
                });
                receivedShape.add(dot);
            }
            break;
        case "pencil":
            receivedShape = new Konva.Line({
                id: drawingData.id,
                sessionid: drawingData.sessionid,
                userid: drawingData.userid,
                stroke: drawingData.color,
                strokeWidth: drawingData.thickness,
                points: drawingData.points,
                lineCap: 'round',
                lineJoin: 'round',
                opacity: drawingData.opacity,
                zIndex: drawingData.zIndex,
            });
    }

    layer.add(receivedShape);
    layer.batchDraw();
});

connection.on("ReceiveTextData", (textData) => {
    console.log("Получение текста от сервера:", textData);

    const textNode = new Konva.Text({
        id: textData.id,
        sessionid: textData.sessionid,
        userid: textData.userid,
        x: textData.x,
        y: textData.y,
        text: textData.text,
        fontSize: 20,
        fontFamily: 'Arial',
        fill: textData.color,
        draggable: true,
        zIndex: textData.zIndex,
    });

    textNode.on('dragend', () => {
        console.log("Текст отпущен:", textNode.x(), textNode.y());

        connection.invoke("MoveTextData", {
            id: textNode.id(),
            x: textNode.x(),
            y: textNode.y()
        }).catch(err => console.error("Ошибка перемещения текста:", err));
    });
    let longPressTimeout;

    function startLongPress() {
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

    konvaElement.on('dragstart', cancelLongPress);

    textNode.on('touchstart', startLongPress);
    textNode.on('touchend', cancelLongPress);
    textNode.on('touchmove', cancelLongPress);

    layer.add(textNode);
    layer.batchDraw();
});

connection.on("ReceiveTextMove", (textData) => {
    console.log("Получение перемещения текста от сервера:", textData);

    const textNode = layer.findOne(`#${textData.id}`);
    if (textNode) {
        textNode.position({ x: textData.x, y: textData.y });
        layer.batchDraw();
    }
});

connection.on("ReceiveTextDelete", (textId) => {
    const textNode = layer.findOne(`#${textId}`);
    if (textNode) {
        textNode.destroy();
        layer.batchDraw();
    }
});

connection.on("ReceiveTextUpdate", (updatedText) => {
    const textNode = layer.findOne(`#${updatedText.id}`);
    if (textNode) {
        textNode.text(updatedText.text);
        textNode.fontSize(updatedText.fontSize);
        textNode.fontFamily(updatedText.fontFamily);
        textNode.fill(updatedText.color);
        textNode.x(updatedText.x);
        textNode.y(updatedText.y);
        textNode.zIndex(updatedText.zIndex);

        layer.batchDraw();
    }
});

connection.on("ReceiveImageData", (imageData) => {
    let image = new Image();
    image.src = imageData.url;
    image.onload = function () {
        let konvaImage = new Konva.Image({
            id: imageData.id,
            sessionid: imageData.sessionid,
            userid: imageData.userid,
            image: image,
            x: imageData.x,
            y: imageData.y,
            width: imageData.width,
            height: imageData.height,
            draggable: false,
            rotation: imageData.rotation,
            name: 'image',
            zIndex: imageData.zIndex
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

        layer.add(konvaImage);
        layer.draw();
    };
});

connection.on("ReceiveImageMove", (imageData) => {
    console.log("ReceiveImageData: ", imageData)

    const image = layer.find(node => node.id() === imageData.id)[0];
    if (image) {
        image.x(imageData.x);
        image.y(imageData.y);
        layer.batchDraw();
    }
});

connection.on("ReceiveImageResize", (imageData) => {
    const image = layer.find(node => node.id() === imageData.id)[0];
    if (image) {
        image.x(imageData.x);  
        image.y(imageData.y);
        image.width(imageData.width);
        image.height(imageData.height);
        image.rotation(imageData.rotation);
        layer.batchDraw();
    }
});

connection.on("ReceiveImageDelete", (imageId) => {
    const image = layer.find(node => node.id() === imageId)[0];
    if (image) {
        image.destroy();
        layer.batchDraw();
    }
});

connection.on("ReceiveImageZIndexUpdate", (imageData) => {
    const image = layer.find(node => node.id() === imageData.id)[0];
    if (image) {
        image.zIndex(imageData.zIndex);
        layer.batchDraw();
    }
});

connection.on("ForceDisconnect", function () {
    alert("Вы были удалены из сессии.");
    window.location.href = "/"; 
});

connection.on("UserJoined", (username) => {
    showToast(`Пользователь ${username} присоединился`);
    fetchSessionUsers();
});

connection.on("UserLeft", (username) => {
    showToast(`Пользователь ${username} покинул нас`);
    fetchSessionUsers();
});

connection.on("ForceDisconnect", () => {
    alert("Сеанс завершён хостом!");
    connection.stop(); 
    window.location.href = "index.html";
});


function showToast(message) {
    let toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

connection.on("ElementUnlocked", (elementId) => {
    const el = layer.findOne(`#${elementId}`);
    if (!el) return;
    if (selectedTextNode && selectedTextNode.id() === elementId) {
        disableTextEditing();
    }
});

connection.on("ForceUnlockElement", (elementId, userId) => {
    const myId = sessionStorage.getItem("userId");
    if (userId === myId && selectedTextNode?.id() === elementId) {
        alert("Редактирование текста было завершено из-за бездействия.");
        disableTextEditing();
    }
});
