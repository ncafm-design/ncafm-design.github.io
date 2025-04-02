import {NoiseNCA} from './ncafm.js'

function isInViewport(element) {
    var rect = element.getBoundingClientRect();
    var html = document.documentElement;
    var w = window.innerWidth || html.clientWidth;
    var h = window.innerHeight || html.clientHeight;
    return rect.top < h && rect.left < w && rect.bottom > 0 && rect.right > 0;
}

export function createDemo(divId) {
    const root = document.getElementById(divId);
    const $ = q => root.querySelector(q);
    const $$ = q => root.querySelectorAll(q);

    // const W = 256, H = 256;
    const resolutions = [64, 96, 128, 192, 256];
    var W = 128, H = 128;
    var last_resolution_idx = 0;
    let ca = null;
    let experiment = 'ex3';
    let paused = false;
    let recording = false;

    const canvas = $('#demo-canvas');
    canvas.width = W * 6; //so we can render hexells
    canvas.height = H * 6;
    let gl = canvas.getContext("webgl2", {antialias: true, preserveDrawingBuffer: true});

    if (!gl) {
        console.log('your browser/OS/drivers do not support WebGL2');
        console.log('Switching to WebGL1');
        const gl = canvas.getContext("webgl2");
        const ext1 = gl.getExtension('OES_texture_float');
        if (!ext1) {
            console.log("Sorry, your browser does not support OES_texture_float. Use a different browser");
            // return;
        }

    } else {
        console.log('webgl2 works!');
        const ext2 = gl.getExtension('EXT_color_buffer_float');
        if (!ext2) {
            console.log("Sorry, your browser does not support  EXT_color_buffer_float. Use a different browser");
            // return;
        }
    }

    gl.disable(gl.DITHER);


    twgl.addExtensionsToContext(gl);

    const maxZoom = 32.0;

    const params = {
        // modelSet: 'demo/models.json',
        // modelSet: 'demo/test2.json',
        // modelSet: 'demo/test_pos.json',
        // modelSet: 'data/test3.json',
        metadataJson: 'data/metadata.json',
        metadata: null,
        models: null,
        model_type: "large",

        brushSize: 16,
        autoFill: true,
        debug: false,
        our_version: true,
        zoom: 1.0,
        alignment: 0,
        rotationAngle: 0,
        dt: 1.0,
        dx: 1.0,
        dy: 1.0,
        isotropic: true,

        texture_name: "LYM-TCGA-AAWGSCHH",


        texture_img: null,

        texture_idx: 0,
    };

    let metadata = null;

    let gui = null;
    let currentTexture = null;

    const initTexture = "LYM-TCGA-AAWGSCHH";

    var videoStream = canvas.captureStream(30);
    var mediaRecorder = new MediaRecorder(videoStream);
    var chunks = [];

    mediaRecorder.ondataavailable = function (e) {
        chunks.push(e.data);
    }

    mediaRecorder.onstop = function (e) {
        var blob = new Blob(chunks, {'type': 'video/mp4'});
        chunks = [];
        var videoURL = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.download = params.texture_name;
        link.href = videoURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    initMetaData();

    async function initMetaData(load_meta_data = true) {
        if (load_meta_data) {
            const r = await fetch(params.metadataJson);
            metadata = await r.json();
            params.metadata = metadata;
        } else {
            metadata = params.metadata
        }


        let texture_names = metadata['texture_names'];

        // let texture_images = metadata['texture_images'];

        async function setTextureModel(idx) {
            params.texture_name = texture_names[idx];
            params.texture_img = "images/texture/" + texture_names[idx] + ".jpg"

            params.modelSet = "data/models/" + texture_names[idx] + ".json"
            params.texture_idx = idx;

            $("#origtex").style.background = "url('" + params.texture_img + "')";
            $("#origtex").style.backgroundSize = "100%100%";
            let dtd = document.createElement('p')
            dtd.innerHTML = "Texture Name: " + params.texture_name
            // dtd.href = "https://www.robots.ox.ac.uk/~vgg/data/dtd/"
            $("#texhinttext").innerHTML = '';
            $("#texhinttext").appendChild(dtd);


            updateCA();

            var video = document.getElementById('multiscale_video');
            video.innerHTML = "";
            var source = document.createElement('source');
            source.setAttribute('src', "./videos/multiscale_videos/large_" + params.texture_name + "_low.mp4");
            source.setAttribute('type', 'video/mp4');
            video.appendChild(source);
            video.load()
            video.play();

        }

        let len = texture_names.length;
        for (let idx = 0; idx < len; idx++) {
            let media_path = "";
            let texture_name = "";

            texture_name = texture_names[idx];
            media_path = params.texture_img = "images/texture/" + texture_name + ".jpg"


            const texture = document.createElement('div');
            texture.style.background = "url('" + media_path + "')";
            texture.style.backgroundSize = "100%100%";
            // texture.style.backgroundSize = "100px100px";
            texture.id = name; //html5 support arbitrary id:s
            texture.className = 'texture-square';
            texture.onclick = () => {
                // removeOverlayIcon();
                currentTexture.style.borderColor = "white";
                currentTexture = texture;
                texture.style.borderColor = "rgb(245 140 44)";
                if (!window.matchMedia('(min-width: 500px)').matches && navigator.userAgent.includes("Chrome")) {
                    texture.scrollIntoView({behavior: "smooth", block: "nearest", inline: "center"})
                }
                setTextureModel(idx);
            };
            let gridBox = $('#texture');


            if (texture_name == initTexture) {
                currentTexture = texture;
                texture.style.borderColor = "rgb(245 140 44)";
                gridBox.prepend(texture);

            } else {
                gridBox.insertBefore(texture, gridBox.lastElementChild);
            }


        }
        setTextureModel(0);


        //
        // $$(".pattern-selector").forEach(sel => {
        //     sel.onscroll = () => {
        //         alret("scroll");
        //         removeOverlayIcon();
        //         sel.onscroll = null;
        //     }
        // });


    }


    function removeOverlayIcon() {
        $$(".overlayicon").forEach(sel2 => {
            sel2.style.opacity = 0.0; //"rgba(255, 255, 255, 0.0)";
        });
    }

    function createGUI(models) {
        if (gui != null) {
            gui.destroy();
        }
        gui = new dat.GUI();
        if (!params.debug) {
            dat.GUI.toggleHide();
        }
        const brush2idx = Object.fromEntries(models.model_names.map((s, i) => [s, i]));
        params.modelname = models.model_names[params.model];
        gui.add(params, 'brushSize').min(1).max(32).step(1);
        gui.add(params, 'zoom').min(1).max(20);

    }

    function canvasToGrid(x, y) {
        const [w, h] = ca.gridSize;
        const gridX = x / canvas.clientWidth * w;
        const gridY = y / canvas.clientHeight * h;
        return [gridX, gridY];
    }

    function getMousePos(e) {
        return canvasToGrid(e.offsetX, e.offsetY);
    }

    function createCA() {
        ca = new NoiseNCA(gl, params.models, [W, H], gui, params.our_version);

        ca.paint(0, 0, 10000, 0, [0.5, 0.5]);

        ca.clearCircle(0, 0, 1000);
        ca.alignment = params.alignment;
        ca.rotationAngle = params.rotationAngle

    }


    function getTouchPos(touch) {
        const rect = canvas.getBoundingClientRect();
        return canvasToGrid(touch.clientX - rect.left, touch.clientY - rect.top);
    }

    let prevPos = [0, 0]

    function click(pos) {
        const [x, y] = pos;
        const [px, py] = prevPos;
        let brushSize = params.brushSize * W / 128.0
        ca.clearCircle(x, y, brushSize, null, params.zoom);
        // ca.paint(x, y, params.brushSize, params.model, [x - px, y - py]);
        prevPos = pos;
    }


    function updateDx() {
        params.isotropic = $('#scaling_mode').checked;
        let dx = parseFloat($('#dx').value);
        let dx_ratio = (dx - $('#dx').min) / ($('#dx').max - $('#dx').min)
        $('#dx').style.background = "linear-gradient(to right, indianred 0%, greenyellow " + (dx_ratio * 100) + "%, #fff " + (dx_ratio * 100) + "%, #fff 100%)";


        if (params.isotropic) {
            let dy = dx;
            $('#dy').value = dy;
            $('#dy').style.background = "linear-gradient(to right, indianred 0%, greenyellow " + (dx_ratio * 100) + "%, #fff " + (dx_ratio * 100) + "%, #fff 100%)";
            params.dy = Math.pow(2.0, -dy);
            $('#dyLabel').innerHTML = params.dy.toFixed(2);

        }

        params.dx = Math.pow(2.0, -dx);

        $('#dxLabel').innerHTML = params.dx.toFixed(2);
        updateDt();

    }

    function updateDy() {
        params.isotropic = $('#scaling_mode').checked;
        let dy = parseFloat($('#dy').value);
        let dy_ratio = (dy - $('#dy').min) / ($('#dy').max - $('#dy').min)
        $('#dy').style.background = "linear-gradient(to right, indianred 0%, greenyellow " + (dy_ratio * 100) + "%, #fff " + (dy_ratio * 100) + "%, #fff 100%)";


        if (params.isotropic) {
            let dx = dy;
            $('#dx').value = dx;
            $('#dx').style.background = "linear-gradient(to right, indianred 0%, greenyellow " + (dy_ratio * 100) + "%, #fff " + (dy_ratio * 100) + "%, #fff 100%)";
            params.dx = Math.pow(2.0, -dx);
            $('#dxLabel').innerHTML = params.dx.toFixed(2);

        }

        params.dy = Math.pow(2.0, -dy);
        $('#dyLabel').innerHTML = params.dy.toFixed(2);

        updateDt();

    }


    function updateDt() {

        params.dt = parseFloat($('#dt').value);
        params.dt = Math.min(params.dt, params.dx * params.dx, params.dy * params.dy);
        $('#dt').value = params.dt;
        $('#dtLabel').innerHTML = params.dt.toFixed(2);
        $('#dt').style.background = "linear-gradient(to right, indianred 0%, greenyellow " + (params.dt * 100) + "%, #fff " + (params.dt * 100) + "%, #fff 100%)";
    }

    function updateUI() {
        $$('#model-hints span').forEach(e => {
            e.style.display = e.id.startsWith(experiment) ? "inline" : "none";
        });
        $('#play').style.display = paused ? "inline" : "none";
        $('#pause').style.display = !paused ? "inline" : "none";

        const speed = parseInt($('#speed').value);
        $('#speedLabel').innerHTML = ['1/60 x', '1/30', '1/10 x', '1/2 x', '1x', '2x', '4x', '6x', '<b>max</b>'][speed + 4];

        const resolution_idx = parseInt($('#resolution').value);
        $('#resolutionLabel').innerHTML = ['64x64', '96x96', '128x128', '192x192', '256x256'][resolution_idx + 2];
        W = resolutions[resolution_idx + 2]
        H = resolutions[resolution_idx + 2]
        canvas.width = W * 6;
        canvas.height = H * 6;

        if (resolution_idx != last_resolution_idx) {
            createCA();
            last_resolution_idx = resolution_idx;
        }
        // ca = new CA(gl, models, [W, H], gui, params.our_version);
        // ca.paint(0, 0, 10000, params.model, [0.5, 0.5]);


        params.rotationAngle = parseInt($('#rotation').value);
        $('#rotationLabel').innerHTML = params.rotationAngle + "&deg;";








        $('#zoomOut').classList.toggle('disabled', params.zoom <= 1.0);
        $('#zoomIn').classList.toggle('disabled', params.zoom >= maxZoom);
    }

    // function Screenshot(name) {
    //     const uri = canvas.toDataURL();
    //     var link = document.createElement("a");
    //     link.download = params.texture_name + "-dx" + params.dx + ".png";
    //     link.href = uri;
    //     document.body.appendChild(link);
    //     link.click();
    //     document.body.removeChild(link);
    //     // delete link;
    // }

    function initUI() {
        $('#record').onclick = () => {
            recording = !recording
            $('#record_on').style.display = recording ? "inline" : "none";
            $('#record_off').style.display = !recording ? "inline" : "none";
            if (recording) {
                mediaRecorder.start();
            } else {
                mediaRecorder.stop();
            }
        };

        // $('#screenshot').onclick = () => {
        //     Screenshot();
        // };

        $('#play-pause').onclick = () => {
            paused = !paused;
            $('#play').style.display = paused ? "inline" : "none";
            $('#pause').style.display = !paused ? "inline" : "none";
            // updateUI();
        };
        $('#reset').onclick = () => {
            ca.paint(0, 0, 10000, 0, [0.5, 0.5]);

            ca.clearCircle(0, 0, 1000);

        };
        // $('#benchmark').onclick = () => {
        //     ca.benchmark();
        // };

        $$('#alignSelect input').forEach((sel, i) => {
            sel.onchange = () => {
                params.alignment = i
            }
        });

        $$('#brushSelect input').forEach((sel, i) => {
            sel.onchange = () => {
                if (i == 0) {
                    params.brushSize = 4;
                } else {
                    if (i == 1) {
                        params.brushSize = 8;
                    } else {
                        params.brushSize = 16;
                    }
                }
            }
        });

        $$('#gridSelect input').forEach(sel => {
            sel.onchange = () => {
                params.hexGrid = sel.id == 'gridHex';
            }
        });
        $('#speed').onchange = updateUI;
        $('#speed').oninput = updateUI;
        $('#rotation').onchange = updateUI;
        $('#rotation').oninput = updateUI;
        $('#resolution').onchange = updateUI;
        $('#resolution').oninput = updateUI;

        $('#dt').onchange = updateDt;
        $('#dt').oninput = updateDt;


        $('#dx').onchange = updateDx;
        $('#dx').oninput = updateDx;

        $('#dy').onchange = updateDy;
        $('#dy').oninput = updateDy;

        $('#scaling_mode').onchange = updateDx;
        $('#scaling_mode').oninput = updateDx;


        $('#zoomIn').onclick = () => {
            if (params.zoom < maxZoom) {
                params.zoom *= 2.0;
            }
            updateUI();
        };
        $('#zoomOut').onclick = () => {
            if (params.zoom > 1.0) {
                params.zoom /= 2.0;
            }
            updateUI();
        };


        canvas.onmousedown = e => {
            e.preventDefault();
            if (e.buttons == 1) {
                click(getMousePos(e));
            }
        }
        canvas.onmousemove = e => {
            e.preventDefault();
            if (e.buttons == 1) {
                click(getMousePos(e));
            }
        }
        canvas.addEventListener("touchstart", e => {
            e.preventDefault();
            click(getTouchPos(e.changedTouches[0]));
        });
        canvas.addEventListener("touchmove", e => {
            e.preventDefault();
            for (const t of e.touches) {
                click(getTouchPos(t));
            }
        });
        updateUI();
    }

    async function updateCA() {
        // Fetch models from json file
        const firstTime = ca == null;

        const r = await fetch(params.modelSet);
        const models = await r.json();
        console.log('updateCA models', models)
        console.log('updateCA r', r)
        params.models = models;
        createCA();

        window.ca = ca;
        if (firstTime) {
            createGUI(models);
            initUI();
            updateUI();
            updateDx();
            updateDy();
            requestAnimationFrame(render);

        }


    }

    // updateCA();

    let lastDrawTime = 0;
    let stepsPerFrame = 1;
    let frameCount = 0;

    let first = true;

    function render(time) {
        if (!isInViewport(canvas)) {
            requestAnimationFrame(render);
            return;
        }

        if (first) {
            first = false;
            requestAnimationFrame(render);
            return;
        }

        ca.rotationAngle = params.rotationAngle;
        ca.alignment = params.alignment;
        ca.dt = params.dt;
        ca.dx = params.dx;
        ca.dy = params.dy
        // ca.hexGrid = params.hexGrid;

        if (!paused) {
            const speed = parseInt($("#speed").value);
            if (speed <= 0) {  // slow down by skipping steps
                const skip = [1, 2, 10, 30, 60][-speed];
                // alert(skip)
                stepsPerFrame = (frameCount % skip) ? 0 : 1;
                // alert(stepsPerFrame)
                frameCount += 1;
            } else if (speed > 0) { // speed up by making more steps per frame
                const interval = time - lastDrawTime;
                stepsPerFrame += interval < 20.0 ? 1 : -1;
                stepsPerFrame = Math.max(1, stepsPerFrame);
                stepsPerFrame = Math.min(stepsPerFrame, [1, 2, 4, 6, Infinity][speed])
                // stepsPerFrame = 600;
            }
            for (let i = 0; i < stepsPerFrame; ++i) {
                ca.step();
            }
            // $("#stepCount").innerText = ca.getStepCount();
            // $("#ips").innerText = ca.fps();
        }
        lastDrawTime = time;

        twgl.bindFramebufferInfo(gl);
        ca.draw(params.zoom);
        requestAnimationFrame(render);
    }
}
