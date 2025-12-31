// 全局变量
let scene, camera, renderer, earth, controls;
let latitudeLines = [];   // 纬线
let longitudeLines = [];  // 经线
let latitudeLabels = [];  // 纬度标签
let longitudeLabels = []; // 经度标签
let equatorLine, primeMeridianLine;
let tropicLines = [];  // 回归线和极圈
let continentLabels = [];  // 七大洲四大洋标签
let markers = [];
let is3DView = true;  // 视图状态：true=3D球体，false=2D平面
let flatMap = null;  // 2D平面地图对象
// 存储3D模式的经纬网，用于切换回3D时恢复
let latitudeLines3D = [];
let longitudeLines3D = [];
let latitudeLabels3D = [];
let longitudeLabels3D = [];
let equatorLine3D, primeMeridianLine3D;
let tropicLines3D = [];

// AI寻宝游戏相关变量
let gameActive = false;
let treasureLocation = null;
let treasureClue = "";

// 新游戏系统变量
let currentLevel = 0;  // 当前关卡 (1-5)
let passedLevels = [];  // 已通关关卡
let currentAnswer = null;  // 当前关卡的答案
let hintShown = false;  // 是否显示过提示
let selectedOption = null;  // 当前选中的选项
let targetPoint = null;  // 目标点坐标（用于第1、3、4关）
let startPoint = null;  // 起点坐标（用于第3、4、5关）

// 初始化Three.js场景
function init() {
    console.log('开始初始化3D地球系统...');
    
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000814);
    console.log('场景创建成功');
    
    // 获取画布元素
    const canvas = document.getElementById('earthCanvas');
    
    // 创建相机
    camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    // 设置相机初始位置：从稍微偏北的位置观看，确保东西方向正确
    camera.position.set(0, 0.5, 3);  // 稍微从北半球上方观看
    camera.lookAt(0, 0, 0);
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // 添加光源
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);
    
    // 创建地球
    createEarth();
    console.log('地球模型创建成功');
    
    // 创建控制控件
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;  // 最小距离
    controls.maxDistance = 10;   // 最大距离
    controls.target.set(0, 0, 0);  // 确保始终围绕原点旋转
    
    // 启用触摸屏支持
    controls.enableRotate = true;      // 启用旋转（鼠标/单指触摸）
    controls.enableZoom = true;        // 启用缩放（滚轮/双指缩放）
    controls.enablePan = false;        // 禁用平移（保持地球居中）
    
    // 触摸控制配置
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,       // 单指触摸：旋转地球
        TWO: THREE.TOUCH.DOLLY_PAN     // 双指触摸：缩放地球
    };
    
    // 优化触摸体验
    controls.rotateSpeed = 1.0;        // 旋转速度
    controls.zoomSpeed = 1.2;          // 缩放速度
    
    // 更新状态指示器
    updateStatus('系统就绪 ✓');
    console.log('3D地球系统初始化完成!');
    
    // 添加事件监听器
    setupEventListeners();
    console.log('事件监听器已设置');
    
    // 添加鼠标点击事件以支持寻宝游戏
    setupMouseClickHandler();
    
    // 开始渲染循环
    animate();
    
    // 处理窗口大小调整
    window.addEventListener('resize', onWindowResize);
}

// 创建地球
function createEarth() {
    // 地球几何体
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // 地球材质 - 使用MeshBasicMaterial取消光照效果
    const material = new THREE.MeshBasicMaterial({
        color: 0x156289,  // 海洋蓝色（默认颜色）
    });
    
    // 创建地球网格
    earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
    
    // 异步加载地球纹理（使用本地图片，加载速度更快）
    const textureLoader = new THREE.TextureLoader();
    
    // 添加加载进度提示
    updateStatus('正在加载地球纹理...');
    
    textureLoader.load(
        'earth-texture.jpg',  // 使用相对路径
        function(texture) {
            console.log('地球纹理加载成功');
            updateStatus('地球纹理加载完成 ✓');
            material.map = texture;
            material.color.set(0xffffff);  // 设置为白色以显示纹理真实颜色
            material.needsUpdate = true;
        },
        function(xhr) {
            // 加载进度回调
            if (xhr.lengthComputable) {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                updateStatus(`加载地球纹理: ${Math.round(percentComplete)}%`);
                console.log(`纹理加载进度: ${Math.round(percentComplete)}%`);
            }
        },
        function(error) {
            console.error('地球纹理加载失败，详细错误:', error);
            console.error('尝试加载的路径: earth-texture.jpg');
            updateStatus('地球纹理加载失败，使用默认颜色');
        }
    );
    
    // 创建经纬网
    createGridLines();
    
    // 创建赤道线
    createEquatorLine();
    
    // 创建本初子午线
    createPrimeMeridianLine();
    
    // 创建回归线和极圈
    createTropicLines();
}

// 2D/3D视图切换功能
function toggle3DView(is3D) {
    is3DView = is3D;
    
    if (is3D) {
        // 切换到3D球体视图
        console.log('切换到3D球体视图');
        
        // 隐藏2D平面地图，显示3D球体
        if (flatMap) {
            flatMap.visible = false;
        }
        earth.visible = true;
        
        // 隐藏2D经纬网，显示3D经纬网
        hide2DGridLines();
        show3DGridLines();
        
        // 相机位置恢复到3D视角
        new TWEEN.Tween(camera.position)
            .to({ x: 0, y: 0.5, z: 3 }, 1000)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                camera.lookAt(0, 0, 0);
            })
            .start();
        
        // 启用旋转控制
        controls.enableRotate = true;
        controls.enablePan = false;
        
        // 恢复3D模式下的鼠标和触摸控制
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,      // 左键：旋转地球
            MIDDLE: THREE.MOUSE.DOLLY,     // 中键：缩放
            RIGHT: THREE.MOUSE.ROTATE      // 右键：旋转
        };
        
        controls.touches = {
            ONE: THREE.TOUCH.ROTATE,       // 单指触摸：旋转地球
            TWO: THREE.TOUCH.DOLLY_PAN     // 双指触摸：缩放地球
        };
        
        // 确保3D模式下始终绕地球中心旋转
        controls.target.set(0, 0, 0);
        controls.update();
        
    } else {
        // 切换到2D平面地图视图
        console.log('切换到2D平面地图视图');
        
        // 创建2D平面地图（如果还没有创建）
        if (!flatMap) {
            createFlatMap();
        }
        
        // 隐藏3D球体，显示2D平面地图
        earth.visible = false;
        flatMap.visible = true;
        
        // 隐藏3D经纬网，显示2D经纬网
        hide3DGridLines();
        show2DGridLines();
        
        // 相机移动到正上方，俯视视角
        new TWEEN.Tween(camera.position)
            .to({ x: 0, y: 5, z: 0.1 }, 1000)  // 增加相机高度到5，确保能看到整个平面
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                camera.lookAt(0, 0, 0);
            })
            .start();
        
        // 禁用旋转控制，启用平移和缩放
        controls.enableRotate = false;
        controls.enablePan = true;
        
        // 配置2D模式下的鼠标和触摸控制
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,         // 左键：平移地图
            MIDDLE: THREE.MOUSE.DOLLY,     // 中键：缩放
            RIGHT: null                    // 右键：禁用
        };
        
        controls.touches = {
            ONE: THREE.TOUCH.PAN,          // 单指触摸：平移地图
            TWO: THREE.TOUCH.DOLLY_PAN     // 双指触摸：缩放地图
        };
    }
    
    // 如果正在游戏中，重新绘制标记点
    if (currentLevel > 0) {
        redrawGameMarkers();
    }
    
    // 如果七大洲四大洋标签已显示，重新绘制
    if (continentLabels.length > 0) {
        createContinentLabels();
    }
}

// 显示3D经纬网
function show3DGridLines() {
    latitudeLines3D.forEach(line => line.visible = true);
    longitudeLines3D.forEach(line => line.visible = true);
    latitudeLabels3D.forEach(label => label.visible = true);
    longitudeLabels3D.forEach(label => label.visible = true);
    if (equatorLine3D) equatorLine3D.visible = true;
    if (primeMeridianLine3D) primeMeridianLine3D.visible = true;
    tropicLines3D.forEach(line => line.visible = true);
}

// 隐藏3D经纬网
function hide3DGridLines() {
    latitudeLines3D.forEach(line => line.visible = false);
    longitudeLines3D.forEach(line => line.visible = false);
    latitudeLabels3D.forEach(label => label.visible = false);
    longitudeLabels3D.forEach(label => label.visible = false);
    if (equatorLine3D) equatorLine3D.visible = false;
    if (primeMeridianLine3D) primeMeridianLine3D.visible = false;
    tropicLines3D.forEach(line => line.visible = false);
}

// 显示2D经纬网
function show2DGridLines() {
    latitudeLines.forEach(line => line.visible = true);
    longitudeLines.forEach(line => line.visible = true);
    latitudeLabels.forEach(label => label.visible = true);
    longitudeLabels.forEach(label => label.visible = true);
    if (equatorLine) equatorLine.visible = true;
    if (primeMeridianLine) primeMeridianLine.visible = true;
    tropicLines.forEach(line => line.visible = true);
}

// 隐藏2D经纬网
function hide2DGridLines() {
    latitudeLines.forEach(line => line.visible = false);
    longitudeLines.forEach(line => line.visible = false);
    latitudeLabels.forEach(label => label.visible = false);
    longitudeLabels.forEach(label => label.visible = false);
    if (equatorLine) equatorLine.visible = false;
    if (primeMeridianLine) primeMeridianLine.visible = false;
    tropicLines.forEach(line => line.visible = false);
}

// 创建2D平面地图
function createFlatMap() {
    console.log('创建2D平面地图...');
    
    // 创建一个平面矩形，宽高比为2:1（经度360°：纬度180°）
    const planeGeometry = new THREE.PlaneGeometry(6, 3, 64, 32);  // 加大：宽6，高3
    
    // 为平面地图创建专用材质
    const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0x156289,
        side: THREE.DoubleSide  // 双面显示
    });
    
    // 加载平面投影的地球纹理（使用本地图片）
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
        'earth-texture.jpg',  // 使用相对路径
        function(texture) {
            console.log('2D地图纹理加载成功');
            updateStatus('2D地图纹理加载完成 ✓');
            // 保持纹理默认方向（flipY默认为true，纹理会自动翻转）
            planeMaterial.map = texture;
            planeMaterial.color.set(0xffffff);
            planeMaterial.needsUpdate = true;
        },
        function(xhr) {
            // 加载进度回调
            if (xhr.lengthComputable) {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                console.log(`2D地图纹理加载进度: ${Math.round(percentComplete)}%`);
            }
        },
        function(error) {
            console.error('2D地图纹理加载失败，详细错误:', error);
            console.error('尝试加载的路径: earth-texture.jpg');
            updateStatus('2D地图使用默认颜色');
        }
    );
    
    flatMap = new THREE.Mesh(planeGeometry, planeMaterial);
    flatMap.rotation.x = -Math.PI / 2;  // 旋转-90°，让平面水平平铺（正面朝上）
    flatMap.visible = false;  // 初始隐藏
    scene.add(flatMap);
    
    // 重新创建2D经纬网
    createFlatGridLines();
    
    console.log('2D平面地图创建完成');
}

// 为2D平面地图创建经纬网
function createFlatGridLines() {
    // 清除2D经纬网（不影响3D经纬网）
    latitudeLines.forEach(line => scene.remove(line));
    longitudeLines.forEach(line => scene.remove(line));
    latitudeLabels.forEach(label => scene.remove(label));
    longitudeLabels.forEach(label => scene.remove(label));
    if (equatorLine) scene.remove(equatorLine);
    if (primeMeridianLine) scene.remove(primeMeridianLine);
    tropicLines.forEach(line => scene.remove(line));
    
    latitudeLines = [];
    longitudeLines = [];
    latitudeLabels = [];
    longitudeLabels = [];
    tropicLines = [];
    
    // 创建纬线（水平线）
    for (let lat = -80; lat <= 80; lat += 20) {
        const z = -(lat / 90) * 1.5;  // 翻转纬度：负号使北纬在下，南纬在上
        
        // 使用矩形平面创建粗线条（更明显）
        const lineGeometry = new THREE.PlaneGeometry(6, 0.01);  // 宽6，高0.01（加粗）
        const lineMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.95,
            side: THREE.DoubleSide
        });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(0, 0.01, z);
        line.rotation.x = -Math.PI / 2;  // 水平放置
        scene.add(line);
        latitudeLines.push(line);
        
        // 添加纬度标签
        if (lat !== 0) {
            const latText = `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`;
            const label = createTextSprite(latText);
            label.position.set(-3.3, 0.01, z);
            label.scale.set(0.5, 0.12, 1);  // 调大标签尺寸
            scene.add(label);
            latitudeLabels.push(label);
        }
    }
    
    // 创建经线（垂直线）
    for (let lon = -180; lon <= 180; lon += 20) {
        const x = (lon / 180) * 3;
        
        // 使用矩形平面创建粗线条（更明显）
        const lineGeometry = new THREE.PlaneGeometry(0.01, 3);  // 宽0.01（加粗），长3
        const lineMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.95,
            side: THREE.DoubleSide
        });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(x, 0.01, 0);
        line.rotation.x = -Math.PI / 2;  // 水平放置
        scene.add(line);
        longitudeLines.push(line);
        
        // 添加经度标签
        if (lon !== 0 && lon !== 180 && lon !== -180) {
            const lonText = lon > 0 ? `${lon}°E` : `${Math.abs(lon)}°W`;
            const label = createTextSprite(lonText);
            label.position.set(x, 0.01, 1.75);  // 翻转后经度标签在上方（南极侧）
            label.scale.set(0.5, 0.12, 1);  // 调大标签尺寸
            scene.add(label);
            longitudeLabels.push(label);
        }
    }
    
    // 创建赤道（z=0）
    const equatorGeometry = new THREE.PlaneGeometry(6, 0.015);  // 赤道稍微更粗
    const equatorMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
    });
    equatorLine = new THREE.Mesh(equatorGeometry, equatorMaterial);
    equatorLine.position.set(0, 0.02, 0);
    equatorLine.rotation.x = -Math.PI / 2;
    scene.add(equatorLine);
    
    // 赤道标签
    const equatorLabel = createTextSprite('0°(赤道)', '#ff0000');
    equatorLabel.position.set(-3.3, 0.02, 0);
    equatorLabel.scale.set(0.55, 0.13, 1);  // 调大标签尺寸
    scene.add(equatorLabel);
    latitudeLabels.push(equatorLabel);
    
    // 创建本初子午线（x=0）
    const primeGeometry = new THREE.PlaneGeometry(0.015, 3);  // 本初子午线稍微更粗
    const primeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
    });
    primeMeridianLine = new THREE.Mesh(primeGeometry, primeMaterial);
    primeMeridianLine.position.set(0, 0.02, 0);
    primeMeridianLine.rotation.x = -Math.PI / 2;
    scene.add(primeMeridianLine);
    
    // 本初子午线标签
    const primeLabel = createTextSprite('0°(本初子午线)', '#ffff00');
    primeLabel.position.set(0, 0.02, 1.75);  // 翻转后标签在上方（南极侧）
    primeLabel.scale.set(0.65, 0.13, 1);  // 调大标签尺寸
    scene.add(primeLabel);
    longitudeLabels.push(primeLabel);
    
    // 创建回归线和极圈
    const specialLats = [
        { lat: 23.5, name: '北回归线' },
        { lat: -23.5, name: '南回归线' },
        { lat: 66.5, name: '北极圈' },
        { lat: -66.5, name: '南极圈' }
    ];
    
    specialLats.forEach(item => {
        const z = -(item.lat / 90) * 1.5;  // 翻转纬度：负号使北纬在下，南纬在上
        
        // 使用矩形平面创建粗虚线（通过多个短线段模拟）
        const dashCount = 60;  // 虚线段数
        const dashLength = 6 / dashCount;
        const dashWidth = 0.01;  // 线条宽度
        
        for (let i = 0; i < dashCount; i += 2) {  // 每隔2段画1段（实现虚线效果）
            const startX = -3 + i * dashLength;
            const segmentGeometry = new THREE.PlaneGeometry(dashLength * 0.6, dashWidth);
            const segmentMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
            segment.position.set(startX + dashLength * 0.3, 0.01, z);
            segment.rotation.x = -Math.PI / 2;
            scene.add(segment);
            tropicLines.push(segment);
        }
        
        // 标签
        const label = createTextSprite(`${Math.abs(item.lat)}°${item.lat > 0 ? 'N' : 'S'}(${item.name})`);
        label.position.set(-3.3, 0.01, z);
        label.scale.set(0.6, 0.12, 1);  // 调大标签尺寸
        scene.add(label);
        latitudeLabels.push(label);
    });
    
    // 添加南北极标签
    const northPoleLabel = createTextSprite('北极 90°N', '#ffff00');
    northPoleLabel.position.set(-3.3, 0.01, -1.5);  // 翻转后北极在下方
    northPoleLabel.scale.set(0.55, 0.12, 1);  // 调大标签尺寸
    scene.add(northPoleLabel);
    latitudeLabels.push(northPoleLabel);
    
    const southPoleLabel = createTextSprite('南极 90°S', '#ffff00');
    southPoleLabel.position.set(-3.3, 0.01, 1.5);  // 翻转后南极在上方
    southPoleLabel.scale.set(0.55, 0.12, 1);  // 调大标签尺寸
    scene.add(southPoleLabel);
    latitudeLabels.push(southPoleLabel);
}

// 创建经纬网
function createGridLines() {
    // 清除现有的网格线和标签
    latitudeLines3D.forEach(line => scene.remove(line));
    longitudeLines3D.forEach(line => scene.remove(line));
    latitudeLabels3D.forEach(label => scene.remove(label));
    longitudeLabels3D.forEach(label => scene.remove(label));
    latitudeLines3D = [];
    longitudeLines3D = [];
    latitudeLabels3D = [];
    longitudeLabels3D = [];
    
    const gridMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.95
    });
    
    // 创建纬线
    for (let lat = -80; lat <= 80; lat += 20) {
        const radius = Math.cos(THREE.MathUtils.degToRad(lat));
        const y = Math.sin(THREE.MathUtils.degToRad(lat));
        
        const points = [];
        for (let lon = 0; lon <= 360; lon += 2) {  // 增加采样密度
            const x = radius * Math.cos(THREE.MathUtils.degToRad(lon));
            const z = radius * Math.sin(THREE.MathUtils.degToRad(lon));
            points.push(new THREE.Vector3(x, y, z));
        }
        
        // 使用TubeGeometry创建粗线
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, points.length - 1, 0.004, 6, true);
        const tubeMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.95 
        });
        const tubeLine = new THREE.Mesh(tubeGeometry, tubeMaterial);
        scene.add(tubeLine);
        latitudeLines3D.push(tubeLine);  // 存储到3D纬线数组
        
        // 为纬线添加标签（在多个经度位置创建，每90度一个，但不同纬度错开）
        if (lat !== 0) {  // 赤道单独标记
            const latText = `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`;
            // 根据纬度值错开标签位置，避免重叠
            // 正纬度在0°和180°，负纬度在90°和270°
            const startAngle = lat > 0 ? 0 : 45;  // 正纬度从0°开始，负纬度从45°开始
            for (let i = 0; i < 2; i++) {  // 每条纬线只创建2个标签（相对的两个位置）
                const labelLon = startAngle + i * 180;
                const lonRad = THREE.MathUtils.degToRad(labelLon);
                const x = radius * Math.cos(lonRad) * 1.05;
                const z = radius * Math.sin(lonRad) * 1.05;
                const labelPosition = new THREE.Vector3(x, y, z);
                const label = createTextSprite(latText);
                label.position.copy(labelPosition);
                scene.add(label);
                latitudeLabels3D.push(label);  // 存储到3D纬度标签数组
            }
        }
    }
    
    // 添加南北极点标签
    const northPoleLabel = createTextSprite('北极 90°N', '#ffff00');
    northPoleLabel.position.set(0, 1.15, 0);
    northPoleLabel.scale.set(0.6, 0.15, 1);  // 稍微加大
    scene.add(northPoleLabel);
    latitudeLabels3D.push(northPoleLabel);  // 存储到3D纬度标签数组
    
    const southPoleLabel = createTextSprite('南极 90°S', '#ffff00');
    southPoleLabel.position.set(0, -1.15, 0);
    southPoleLabel.scale.set(0.6, 0.15, 1);  // 稍微加大
    scene.add(southPoleLabel);
    latitudeLabels3D.push(southPoleLabel);  // 存储到3D纬度标签数组
    
    // 创建经线（每20度一条）
    // 注意：Three.js逆时针为角度增加，但地理上东经是顺时针
    // 所以：东经使用负角度（360-度数），西经使用正角度
    const longitudes = [
        340, 320, 300, 280, 260, 240, 220, 200,  // 东经 20E-160E（内部使用340-200）
        180,  // 国际日期变更线
        160, 140, 120, 100, 80, 60, 40, 20  // 西经 20W-160W
    ];
    
    longitudes.forEach(lon => {
        const points = [];
        for (let lat = -90; lat <= 90; lat += 2) {  // 增加采样密度
            const radius = Math.cos(THREE.MathUtils.degToRad(lat));
            const y = Math.sin(THREE.MathUtils.degToRad(lat));
            const x = radius * Math.cos(THREE.MathUtils.degToRad(lon));
            const z = radius * Math.sin(THREE.MathUtils.degToRad(lon));
            points.push(new THREE.Vector3(x, y, z));
        }
        
        // 使用TubeGeometry创建粗线
        const curve2 = new THREE.CatmullRomCurve3(points);
        const tubeGeometry2 = new THREE.TubeGeometry(curve2, points.length - 1, 0.004, 6, false);
        const tubeMaterial2 = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.95 
        });
        const tubeLine2 = new THREE.Mesh(tubeGeometry2, tubeMaterial2);
        scene.add(tubeLine2);
        longitudeLines3D.push(tubeLine2);  // 存储到3D经线数组
        
        // 为经线添加标签（在赤道位置）
        if (lon !== 0 && lon !== 180) {  // 本初子午线和180°线单独标记
            // 标签位置应该和经线的实际位置一致
            const lonRad = THREE.MathUtils.degToRad(lon);
            const x = Math.cos(lonRad) * 1.05;  // X = cos(经度)
            const z = Math.sin(lonRad) * 1.05;  // Z = sin(经度)
            const labelPosition = new THREE.Vector3(x, 0, z);
            
            // 经度标签
            let lonText;
            if (lon > 180 && lon < 360) {
                // 200-340度 → 显示为 20E-160E
                lonText = `${360 - lon}°E`;
                console.log(`东经 ${360-lon}°E (lon=${lon}) 位置: x=${x.toFixed(2)}, z=${z.toFixed(2)}`);
            } else if (lon > 0 && lon < 180) {
                // 20-160度 → 显示为 20W-160W
                lonText = `${lon}°W`;
                console.log(`西经 ${lon}°W 位置: x=${x.toFixed(2)}, z=${z.toFixed(2)}`);
            }
            
            if (lonText) {
                const label = createTextSprite(lonText);
                label.position.copy(labelPosition);
                scene.add(label);
                longitudeLabels3D.push(label);  // 存储到3D经度标签数组
            }
        }
    });
}

// 创建赤道线
function createEquatorLine() {
    if (equatorLine3D) scene.remove(equatorLine3D);
    
    const points = [];
    for (let i = 0; i <= 360; i++) {  // 增加采样密度
        const theta = (i / 360) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
    }
    
    // 使用TubeGeometry创建粗红线
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 360, 0.008, 8, true);  // 加粗赤道线（0.008）
    const tubeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,  // 红色
        transparent: false
    });
    equatorLine3D = new THREE.Mesh(tubeGeometry, tubeMaterial);
    scene.add(equatorLine3D);
    
    // 添加赤道标签（在两个相对位置，避免与普通纬线标签和经线标签重叠）
    // 赤道标签在10°和190°位置（避开20°W等经线标签）
    for (let i = 0; i < 2; i++) {
        const labelLon = 10 + i * 180;
        const lonRad = THREE.MathUtils.degToRad(labelLon);
        const x = Math.cos(lonRad) * 1.08;
        const z = Math.sin(lonRad) * 1.08;
        const equatorLabel = createTextSprite('0°(赤道)', '#ff0000');
        equatorLabel.position.set(x, 0, z);
        scene.add(equatorLabel);
        latitudeLabels3D.push(equatorLabel);  // 赤道标签存储到3D纬度标签数组
    }
}

// 创建本初子午线（修正为通过伦敦）
function createPrimeMeridianLine() {
    if (primeMeridianLine3D) scene.remove(primeMeridianLine3D);
    
    const points = [];
    
    // 本初子午线应该在X轴正方向（经度0°，通过伦敦）
    for (let i = 0; i <= 180; i++) {
        const phi = (i / 180) * Math.PI;
        const y = Math.cos(phi);
        const x = Math.sin(phi);
        points.push(new THREE.Vector3(x, y, 0));
    }
    
    // 使用TubeGeometry创建粗黄线
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 180, 0.008, 8, false);  // 加粗本初子午线（0.008）
    const tubeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,  // 黄色
        transparent: false
    });
    primeMeridianLine3D = new THREE.Mesh(tubeGeometry, tubeMaterial);
    scene.add(primeMeridianLine3D);
    
    // 添加本初子午线标签（北极位置）
    const primeLabel = createTextSprite('0°(本初子午线)', '#ffff00');
    primeLabel.position.set(1.08, 0, 0);
    console.log('本初子午线位置: x=1.08, z=0');
    scene.add(primeLabel);
    longitudeLabels3D.push(primeLabel);  // 本初子午线标签存储到3D经度标签数组
    
    // 添加180°经线标签（南极位置）
    const oppositeLabel = createTextSprite('180°', '#ffff00');
    oppositeLabel.position.set(-1.08, 0, 0);
    scene.add(oppositeLabel);
    longitudeLabels3D.push(oppositeLabel);  // 180°经线标签存储到3D经度标签数组
}

// 创建回归线和极圈
function createTropicLines() {
    // 清除现有的回归线和极圈
    tropicLines3D.forEach(line => scene.remove(line));
    tropicLines3D = [];
    
    // 四条特殊纬线：北回归线、南回归线、北极圈、南极圈
    const specialLats = [
        { lat: 23.5, name: '北回归线' },
        { lat: -23.5, name: '南回归线' },
        { lat: 66.5, name: '北极圈' },
        { lat: -66.5, name: '南极圈' }
    ];
    
    specialLats.forEach(item => {
        const radius = Math.cos(THREE.MathUtils.degToRad(item.lat));
        const y = Math.sin(THREE.MathUtils.degToRad(item.lat));
        
        const points = [];
        for (let lon = 0; lon <= 360; lon += 2) {
            const x = radius * Math.cos(THREE.MathUtils.degToRad(lon));
            const z = radius * Math.sin(THREE.MathUtils.degToRad(lon));
            points.push(new THREE.Vector3(x, y, z));
        }
        
        // 使用TubeGeometry创建粗虚线效果
        // 通过创建多个小段来模拟虚线
        for (let i = 0; i < points.length - 1; i++) {
            // 每隔一段创建线段（虚线效果）
            if (i % 4 < 2) {  // 50%的线段显示，50%空白
                const segmentPoints = [points[i], points[i + 1]];
                const curve = new THREE.CatmullRomCurve3(segmentPoints);
                const tubeGeometry = new THREE.TubeGeometry(curve, 1, 0.004, 6, false);
                const tubeMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0x00ffff, 
                    transparent: true, 
                    opacity: 0.9
                });
                const tubeLine = new THREE.Mesh(tubeGeometry, tubeMaterial);
                scene.add(tubeLine);
                tropicLines3D.push(tubeLine);
            }
        }
        
        // 添加标签（在两个相对位置，错开分布避免重叠）
        // 北回归线和北极在67.5°，南回归线和南极圈在112.5°
        const startAngle = item.lat > 0 ? 67.5 : 112.5;
        for (let i = 0; i < 2; i++) {
            const labelLon = startAngle + i * 180;
            const lonRad = THREE.MathUtils.degToRad(labelLon);
            const x = radius * Math.cos(lonRad) * 1.08;
            const z = radius * Math.sin(lonRad) * 1.08;
            const labelPosition = new THREE.Vector3(x, y, z);
            const label = createTextSprite(`${Math.abs(item.lat)}°${item.lat > 0 ? 'N' : 'S'}(${item.name})`);
            label.position.copy(labelPosition);
            scene.add(label);
            latitudeLabels3D.push(label);  // 回归线和极圈标签存储到3D纬度标签数组
        }
    });
}

// 创建文字精灵（用于显示经纬度标签）
function createTextSprite(text, color = '#00ffff') {
    // 创建canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    
    // 设置字体样式
    context.font = 'Bold 42px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // 绘制背景（半透明黑色）
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const textWidth = context.measureText(text).width;
    context.fillRect((canvas.width - textWidth - 20) / 2, 20, textWidth + 20, 88);
    
    // 绘制文字
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // 创建精灵材质
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        depthTest: true,  // 启用深度测试，背面不显示
        depthWrite: false
    });
    
    // 创建精灵
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.5, 0.125, 1);  // 调整标签大小
    
    return sprite;
}

// 更新状态指示器
function updateStatus(message) {
    const statusElement = document.getElementById('statusIndicator');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 视图切换 - 3D/2D
    document.getElementById('view3DToggle').addEventListener('change', function() {
        toggle3DView(this.checked);
    });
    
    // 图层控制 - 纬线
    document.getElementById('latitudeLineToggle').addEventListener('change', function() {
        if (is3DView) {
            latitudeLines3D.forEach(line => line.visible = this.checked);
        } else {
            latitudeLines.forEach(line => line.visible = this.checked);
        }
    });
    
    // 图层控制 - 经线
    document.getElementById('longitudeLineToggle').addEventListener('change', function() {
        if (is3DView) {
            longitudeLines3D.forEach(line => line.visible = this.checked);
        } else {
            longitudeLines.forEach(line => line.visible = this.checked);
        }
    });
    
    // 图层控制 - 纬度值
    document.getElementById('latitudeValueToggle').addEventListener('change', function() {
        if (is3DView) {
            latitudeLabels3D.forEach(label => label.visible = this.checked);
        } else {
            latitudeLabels.forEach(label => label.visible = this.checked);
        }
    });
    
    // 图层控制 - 经度值
    document.getElementById('longitudeValueToggle').addEventListener('change', function() {
        if (is3DView) {
            longitudeLabels3D.forEach(label => label.visible = this.checked);
        } else {
            longitudeLabels.forEach(label => label.visible = this.checked);
        }
    });
    
    document.getElementById('equatorToggle').addEventListener('change', function() {
        if (is3DView) {
            if (equatorLine3D) equatorLine3D.visible = this.checked;
        } else {
            if (equatorLine) equatorLine.visible = this.checked;
        }
    });
    
    document.getElementById('primeMeridianToggle').addEventListener('change', function() {
        if (is3DView) {
            if (primeMeridianLine3D) primeMeridianLine3D.visible = this.checked;
        } else {
            if (primeMeridianLine) primeMeridianLine.visible = this.checked;
        }
    });
    
    // 回归线和极圈控制
    document.getElementById('tropicsToggle').addEventListener('change', function() {
        if (is3DView) {
            tropicLines3D.forEach(line => line.visible = this.checked);
        } else {
            tropicLines.forEach(line => line.visible = this.checked);
        }
    });
    
    // 七大洲四大洋控制
    document.getElementById('continentsToggle').addEventListener('change', function() {
        if (this.checked) {
            createContinentLabels();
        } else {
            continentLabels.forEach(label => scene.remove(label));
            continentLabels = [];
        }
    });
    
    // 坐标定位
    document.getElementById('locateBtn').addEventListener('click', locateToCoordinates);
    document.getElementById('resetViewBtn').addEventListener('click', resetView);
    
    // 调用游戏事件监听器
    setupGameEventListeners();
}

// 创建七大洲四大洋标签
function createContinentLabels() {
    // 清除现有标签
    continentLabels.forEach(label => scene.remove(label));
    continentLabels = [];
    
    // 七大洲四大洋的大致位置（地理经纬度）
    const locations = [
        // 七大洲
        { name: '亚洲', lat: 34, lon: 100, color: '#ffaa00' },  // 100°E
        { name: '欧洲', lat: 54, lon: 15, color: '#ffaa00' },   // 15°E
        { name: '非洲', lat: 0, lon: 20, color: '#ffaa00' },    // 20°E
        { name: '北美洲', lat: 45, lon: -100, color: '#ffaa00' }, // 100°W
        { name: '南美洲', lat: -15, lon: -60, color: '#ffaa00' }, // 60°W
        { name: '大洋洲', lat: -25, lon: 135, color: '#ffaa00' }, // 135°E
        { name: '南极洲', lat: -80, lon: 0, color: '#ffaa00' },  // 0°
        // 四大洋
        { name: '太平洋', lat: 0, lon: -160, color: '#00aaff' },  // 160°W
        { name: '大西洋', lat: 25, lon: -40, color: '#00aaff' },  // 40°W
        { name: '印度洋', lat: -20, lon: 75, color: '#00aaff' },  // 75°E
        { name: '北冰洋', lat: 80, lon: 0, color: '#00aaff' }    // 0°
    ];
    
    locations.forEach(loc => {
        let x, y, z;
        
        if (is3DView) {
            // 3D模式：球体坐标转换
            // 将地理经度转换为Three.js角度
            let threeLon;
            if (loc.lon >= 0) {
                // 东经：转换为360-经度
                threeLon = 360 - loc.lon;
            } else {
                // 西经：取绝对值
                threeLon = -loc.lon;
            }
            
            const phi = (90 - loc.lat) * Math.PI / 180;
            const theta = threeLon * Math.PI / 180;
            
            x = Math.sin(phi) * Math.cos(theta) * 1.1;
            y = Math.cos(phi) * 1.1;
            z = Math.sin(phi) * Math.sin(theta) * 1.1;
            
            console.log(`[3D] ${loc.name}: 地理经纬度(${loc.lat}°, ${loc.lon}°) -> 球面坐标(x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)})`);
        } else {
            // 2D模式：平面坐标映射
            x = (loc.lon / 180) * 3;
            z = -(loc.lat / 90) * 1.5;  // 负号翻转，与经纬网一致
            y = 0.05;  // 标签在地图上方
            
            console.log(`[2D] ${loc.name}: 地理经纬度(${loc.lat}°, ${loc.lon}°) -> 平面坐标(x=${x.toFixed(2)}, z=${z.toFixed(2)})`);
        }
        
        const label = createTextSprite(loc.name, loc.color);
        label.position.set(x, y, z);
        
        if (is3DView) {
            label.scale.set(0.4, 0.1, 1);  // 3D模式标签尺寸
        } else {
            label.scale.set(0.5, 0.12, 1);  // 2D模式标签尺寸（稍大）
        }
        
        scene.add(label);
        continentLabels.push(label);
    });
}

// 设置鼠标点击处理器
function setupMouseClickHandler() {
    const canvas = document.getElementById('earthCanvas');
    canvas.addEventListener('click', onMouseClick);
}

// 鼠标点击事件处理
function onMouseClick(event) {
    if (!gameActive) return;
    
    // 获取点击位置的归一化设备坐标
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // 设置射线投射器
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    let lat, lon;
    
    if (is3DView) {
        // 3D模式：计算与地球的交点
        const intersects = raycaster.intersectObject(earth);
        
        if (intersects.length > 0) {
            // 获取交点位置
            const point = intersects[0].point;
            
            // 转换为经纬度
            lat = 90 - (Math.acos(point.y) * 180 / Math.PI);
            lon = -(Math.atan2(point.z, point.x) * 180 / Math.PI);
            
            console.log(`3D点击: 地理坐标(${lat.toFixed(1)}°, ${lon.toFixed(1)}°)`);
        } else {
            return;  // 没有点击到地球
        }
    } else {
        // 2D模式：计算与平面地图的交点
        const intersects = raycaster.intersectObject(flatMap);
        
        if (intersects.length > 0) {
            // 获取交点位置（这是世界坐标系中的位置）
            const point = intersects[0].point;
            
            // flatMap被旋转了 -Math.PI/2（绕X轴），所以：
            // - 平面的本地X轴 → 世界空间的X轴（经度）
            // - 平面的本地Y轴 → 世界空间的Z轴（纬度）
            // - 平面的本地Z轴 → 世界空间的-Y轴
            
            // 将世界坐标转换为地理经纬度
            // x: -3到3 → 经度: -180°到180°
            lon = (point.x / 3) * 180;
            // z: 1.5到-1.5 → 纬度: -90°到90°（注意：经纬网使用了负号翻转）
            // 所以这里也需要用负号翻转回来
            lat = -(point.z / 1.5) * 90;
            
            console.log(`2D点击: 世界坐标(x=${point.x.toFixed(2)}, y=${point.y.toFixed(2)}, z=${point.z.toFixed(2)}) -> 地理坐标(${lat.toFixed(1)}°, ${lon.toFixed(1)}°)`);
        } else {
            return;  // 没有点击到平面地图
        }
    }
    
    // 保存用户答案
    currentAnswer = { lat: lat, lon: lon };
    
    // 在点击位置添加标记点
    if (is3DView) {
        // 3D模式：需要计算球面坐标
        let threeLon;
        if (lon >= 0) {
            threeLon = 360 - lon;
        } else {
            threeLon = -lon;
        }
        const phi = (90 - lat) * Math.PI / 180;
        const theta = threeLon * Math.PI / 180;
        const x = Math.sin(phi) * Math.cos(theta) * 1.05;
        const y = Math.cos(phi) * 1.05;
        const z = Math.sin(phi) * Math.sin(theta) * 1.05;
        addMarker(x, y, z);
    } else {
        // 2D模式：使用平面坐标
        const x = (lon / 180) * 3;
        const z = -(lat / 90) * 1.5;
        const y = 0.02;
        addMarker2D(x, y, z);
    }
    
    // 反馈用户点击的坐标
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    document.getElementById('gameFeedbackText').textContent = 
        `你点击的位置是: ${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir}。请点击"确认投放"提交答案。`;
}

// 定位到指定坐标
function locateToCoordinates() {
    const latInput = document.getElementById('latitude').value;
    const lonInput = document.getElementById('longitude').value;
    const latDir = document.getElementById('latDirection').value;
    const lonDir = document.getElementById('lonDirection').value;
    
    if (!latInput || !lonInput) {
        showFeedback("请输入完整的经纬度坐标");
        return;
    }
    
    let lat = parseFloat(latInput);
    let lon = parseFloat(lonInput);
    
    if (isNaN(lat) || isNaN(lon)) {
        showFeedback("请输入有效的数字");
        return;
    }
    
    // 验证范围
    if (lat < 0 || lat > 90 || lon < 0 || lon > 180) {
        showFeedback("经纬度超出有效范围");
        return;
    }
    
    // 地理纬度：北纬为正，南纬为负
    let geoLat = lat;
    if (latDir === 'S') geoLat = -lat;
    
    // 地理经度：东经为正，西经为负
    let geoLon = lon;
    if (lonDir === 'W') geoLon = -lon;
    
    console.log(`定位: 地理坐标(${geoLat}°, ${geoLon}°)`);
    
    if (is3DView) {
        // 3D模式：将地理经度转换为Three.js角度
        let threeLon;
        if (geoLon >= 0) {
            // 东经
            threeLon = 360 - geoLon;
        } else {
            // 西经
            threeLon = -geoLon;
        }
        
        console.log(`3D模式: 地理坐标(${geoLat}°, ${geoLon}°) -> Three.js角度(${geoLat}°, ${threeLon}°)`);
        
        // 转换为弧度
        const phi = (90 - geoLat) * Math.PI / 180;
        const theta = threeLon * Math.PI / 180;
        
        // 计算目标位置
        const targetX = Math.sin(phi) * Math.cos(theta);
        const targetY = Math.cos(phi);
        const targetZ = Math.sin(phi) * Math.sin(theta);
        
        console.log(`3D目标位置: x=${targetX.toFixed(2)}, y=${targetY.toFixed(2)}, z=${targetZ.toFixed(2)}`);
        
        // 创建3D标记
        addMarker(targetX, targetY, targetZ);
        
        // 动画旋转到目标位置
        animateRotation(targetX, targetY, targetZ);
    } else {
        // 2D模式：直接映射到平面坐标
        // 经度：-180°到180° → x: -3到3
        const x = (geoLon / 180) * 3;
        // 纬度：与经纬网标签使用相同公式（负号翻转）
        const z = -(geoLat / 90) * 1.5;
        const y = 0.02;  // 略高于平面
        
        console.log(`2D模式: 地理坐标(${geoLat}°, ${geoLon}°) -> 平面坐标(x=${x.toFixed(2)}, z=${z.toFixed(2)})`);
        
        // 创建2D简单标记（红色圆点）
        addMarker2D(x, y, z);
        
        // 相机平滑移动到标记位置
        animateCamera2D(x, z);
    }
    
    showFeedback(`已定位到: ${lat}°${latDir}, ${lon}°${lonDir}`);
}

// 添加标记
function addMarker(x, y, z) {
    // 移除之前的标记
    markers.forEach(marker => scene.remove(marker));
    markers = [];
    
    // 创建标记几何体
    const markerGeometry = new THREE.ConeGeometry(0.05, 0.2, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    
    // 定位标记
    marker.position.set(x, y, z);
    
    // 使标记朝向球心
    marker.lookAt(0, 0, 0);
    marker.rotateX(Math.PI / 2);
    
    // 将标记稍微移出地球表面
    marker.translateZ(0.05);
    
    scene.add(marker);
    markers.push(marker);
}

// 为2D平面地图添加简单标记（红色圆点）
function addMarker2D(x, y, z) {
    console.log(`[addMarker2D] 开始添加标记: x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)}`);
    
    // 移除之前的标记
    markers.forEach(marker => {
        console.log('[addMarker2D] 移除旧标记');
        scene.remove(marker);
    });
    markers = [];
    
    // 创建红色圆点标记（增大半径，提高Y坐标）
    const markerGeometry = new THREE.CircleGeometry(0.12, 32);  // 增大到半径0.12
    const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        side: THREE.DoubleSide,
        transparent: false,
        depthTest: false  // 禁用深度测试，确保始终可见
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    
    // 设置标记位置（Y坐标提高到0.1，确保在地图上方）
    marker.position.set(x, 0.1, z);
    
    // 旋转使圆形水平放置（和地图平面平行）
    marker.rotation.x = -Math.PI / 2;
    
    // 设置渲染顺序，确保在最上层
    marker.renderOrder = 999;
    
    scene.add(marker);
    markers.push(marker);
    
    console.log(`[addMarker2D] 2D标记已添加在位置: (${x.toFixed(2)}, 0.1, ${z.toFixed(2)}), markers.length=${markers.length}`);
    console.log(`[addMarker2D] 标记对象:`, marker);
}

// 2D模式下相机平滑移动到标记位置
function animateCamera2D(targetX, targetZ) {
    // 计算目标相机位置（保持俯视角度）
    const targetCameraX = targetX;
    const targetCameraY = 5;  // 保持高度
    const targetCameraZ = targetZ + 0.1;  // 略微偏移以更好观看
    
    // 使用TWEEN动画平滑移动相机
    new TWEEN.Tween(camera.position)
        .to({ x: targetCameraX, y: targetCameraY, z: targetCameraZ }, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
            camera.lookAt(targetX, 0, targetZ);  // 相机始终看向标记位置
            controls.target.set(targetX, 0, targetZ);  // 设置控制器目标
        })
        .onComplete(() => {
            controls.update();
        })
        .start();
    
    console.log(`2D相机移动到: (${targetCameraX.toFixed(2)}, ${targetCameraY.toFixed(2)}, ${targetCameraZ.toFixed(2)})`);
}

// 动画旋转到目标位置
function animateRotation(targetX, targetY, targetZ) {
    // 计算目标看向位置
    const targetPosition = new THREE.Vector3(targetX, targetY, targetZ);
    
    // 当前相机位置
    const startPosition = camera.position.clone();
    
    // 计算目标相机位置（距离地球中心固定距离，朝向目标点）
    const cameraDistance = 2.5;
    const targetCameraPosition = targetPosition.clone().normalize().multiplyScalar(cameraDistance);
    
    // 动画参数
    const duration = 2000; // 2秒
    const startTime = Date.now();
    
    // 动画函数
    function updateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // 插值相机位置
        camera.position.lerpVectors(startPosition, targetCameraPosition, easeProgress);
        
        // 相机始终看向地球中心（原点）
        camera.lookAt(0, 0, 0);
        
        // 更新控制器
        controls.update();
        
        if (progress < 1) {
            requestAnimationFrame(updateCamera);
        } else {
            // 动画结束，确保控制器目标设置为地球中心
            controls.target.set(0, 0, 0);
            controls.update();
        }
    }
    
    updateCamera();
}

// 重置视角
function resetView() {
    // 重置相机位置到正确的观看角度
    new TWEEN.Tween(camera.position)
        .to({ x: 0, y: 0.5, z: 3 }, 1000)  // 从稍微偏北的位置观看
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
            camera.lookAt(0, 0, 0);
            controls.target.set(0, 0, 0);  // 确保控制器目标在原点
        })
        .start();
    
    // 重置控制器
    controls.target.set(0, 0, 0);
    controls.update();
}

// 开始寻宝游戏
function startTreasureHunt() {
    gameActive = true;
    
    // 生成随机宝藏位置（避免极地地区）
    const lat = (Math.random() * 140 - 70); // -70 到 70 度纬度
    const lon = (Math.random() * 360 - 180); // -180 到 180 度经度
    
    treasureLocation = { lat, lon };
    
    // 生成线索
    treasureClue = generateTreasureClue(lat, lon);
    
    // 显示线索
    document.getElementById('clueText').textContent = treasureClue;
    
    showFeedback("寻宝游戏开始！根据线索找到宝藏的位置。");
}

// 生成宝藏线索
function generateTreasureClue(lat, lon) {
    const clues = [
        `我在${lat > 0 ? '北半球' : '南半球'}，${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`,
        `我在${lon > 0 ? '东半球' : '西半球'}，${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`,
        `我的纬度是${lat.toFixed(1)}°${lat >= 0 ? 'N' : 'S'}，经度是${lon.toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`,
        `我位于赤道${lat > 0 ? '以北' : '以南'}${Math.abs(lat).toFixed(1)}度，${lon > 0 ? '本初子午线以东' : '本初子午线以西'}${Math.abs(lon).toFixed(1)}度`,
        `我在${getHemisphere(lat, lon)}半球，那里有独特的地理特征`
    ];
    
    // 根据位置添加特定线索
    if (Math.abs(lat) < 23.5) {
        clues.push("我在热带地区，这里阳光充足");
    } else if (Math.abs(lat) > 66.5) {
        clues.push("我在极地附近，气候寒冷");
    }
    
    if (Math.abs(lon) < 30) {
        clues.push("我在欧洲或非洲附近");
    } else if (lon > 30 && lon < 120) {
        clues.push("我在亚洲");
    } else if (lon > 120) {
        clues.push("我在太平洋西部地区");
    } else if (lon < -30 && lon > -120) {
        clues.push("我在美洲大陆");
    } else {
        clues.push("我在太平洋东部地区");
    }
    
    // 特殊地标线索
    const landmarks = [
        { name: "埃及金字塔", lat: 30, lon: 31 },
        { name: "自由女神像", lat: 40.7, lon: -74 },
        { name: "埃菲尔铁塔", lat: 48.9, lon: 2.3 },
        { name: "悉尼歌剧院", lat: -33.8, lon: 151.2 },
        { name: "长城", lat: 40.4, lon: 116.6 }
    ];
    
    let closestLandmark = null;
    let minDistance = Infinity;
    
    for (const landmark of landmarks) {
        const distance = Math.sqrt(
            Math.pow(lat - landmark.lat, 2) + 
            Math.pow(lon - landmark.lon, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestLandmark = landmark;
        }
    }
    
    if (minDistance < 20) {
        clues.push(`我在${closestLandmark.name}附近`);
    }
    
    // 随机选择一个线索
    return clues[Math.floor(Math.random() * clues.length)];
}

// 获取半球信息
function getHemisphere(lat, lon) {
    if (lat >= 0 && lon >= 0) return "东北";
    if (lat >= 0 && lon < 0) return "西北";
    if (lat < 0 && lon >= 0) return "东南";
    if (lat < 0 && lon < 0) return "西南";
}

// 检查答案
function checkAnswer() {
    if (!gameActive || !treasureLocation) {
        showFeedback("请先开始寻宝游戏");
        return;
    }
    
    // 获取当前相机看向的位置
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // 计算看向位置的经纬度
    const lat = 90 - (Math.acos(direction.y) * 180 / Math.PI);
    const lon = -(Math.atan2(direction.z, direction.x) * 180 / Math.PI);
    
    // 计算与宝藏位置的距离
    const dLat = treasureLocation.lat - lat;
    const dLon = treasureLocation.lon - lon;
    const distance = Math.sqrt(dLat * dLat + dLon * dLon);
    
    // 根据距离给出反馈
    if (distance < 5) {
        showFeedback("恭喜你找到了宝藏！位置非常准确！", true);
        gameActive = false;
        treasureLocation = null;
    } else if (distance < 15) {
        showFeedback("很接近了！再仔细找找看", true);
    } else {
        // 给出方向指引
        let directionText = "";
        if (Math.abs(dLat) > Math.abs(dLon)) {
            directionText = dLat > 0 ? "北" : "南";
        } else {
            directionText = dLon > 0 ? "东" : "西";
        }
        
        // 添加更具体的方位描述
        if (Math.abs(dLat) > Math.abs(dLon)) {
            if (dLon > 0) {
                directionText = dLat > 0 ? "东北" : "东南";
            } else {
                directionText = dLat > 0 ? "西北" : "西南";
            }
        }
        
        showFeedback(`找偏了！宝藏在你的${directionText}方向，距离还有${distance.toFixed(1)}度，请继续努力！`, true);
    }
}

// 显示反馈信息
function showFeedback(message, isGameFeedback = false) {
    const feedbackElement = document.getElementById('feedbackText');
    feedbackElement.textContent = message;
    feedbackElement.style.color = isGameFeedback ? "#ffcc80" : "#b3e5fc";
}

// 窗口大小调整处理
function onWindowResize() {
    const canvas = document.getElementById('earthCanvas');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// 渲染动画循环
function animate() {
    requestAnimationFrame(animate);
    
    // 更新控制器
    controls.update();
    
    // 更新Tween动画
    TWEEN.update();
    
    // 渲染场景
    renderer.render(scene, camera);
}

// 页面加载完成后初始化
window.addEventListener('load', function() {
    console.log('页面加载完成，准备初始化...');
    try {
        init();
    } catch (error) {
        console.error('初始化失败:', error);
        const statusElement = document.getElementById('statusIndicator');
        if (statusElement) {
            statusElement.textContent = '初始化失败，请查看控制台错误';
            statusElement.style.color = '#ff5252';
        }
    }
});

// 捕获全局错误
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
});

// ========== 新游戏系统：时空穿梭者挑战 ==========

// 游戏关卡配置
const gameLevels = {
    1: {
        type: 'choice',  // 选择题
        title: "① 第一关：新兵报到 - 坐标读取",
        story: "🛠️ 雷达扫描到不明飞行物（UFO）悬停在空中，请汇报它的坐标。",
        mission: "🎯 观察地球上的标记点 P，它的经纬度是多少？",
        hint: "💡 提示：请注意，P 点在赤道以北（北纬），本初子午线以东（东经）。",
        targetPoint: { lat: 20, lon: 40 },  // P点坐标
        options: [
            { id: 'A', text: "A. (20°N, 40°W)" },
            { id: 'B', text: "B. (20°S, 40°E)" },
            { id: 'C', text: "C. (20°N, 40°E)", correct: true },
            { id: 'D', text: "D. (40°N, 20°E)" }
        ]
    },
    2: {
        type: 'operate',  // 操作题
        title: "② 第二关：精准投放 - 坐标定位",
        story: "🚁 救援物资已装载，目标地点坐标已确认，请执行投放。",
        mission: "🎯 请转动地球，找到 南纬 30°，西经 60° (30°S, 60°W) 的位置并点击确认。",
        hint: "💡 提示：南纬在赤道以南，西经在本初子午线以西。屏幕角落会实时显示鼠标指向的经纬度。",
        answer: { lat: -30, lon: -60 },
        tolerance: 8,
        showRealtimeCoords: true  // 显示实时坐标
    },
    3: {
        type: 'choice',
        title: "③ 第三关：直线导航 - 正方向判读",
        story: "⛵ 舰队需要直线航行，请确认航向。",
        mission: "🧭 起点 A：(40°N, 100°E)\n终点 B：(40°N, 120°E)\n\n终点 B 位于起点 A 的什么方向？",
        hint: "💡 提示：两点纬度相同（都在40°N），都在北半球。B 点经度（120°E）大于 A 点（100°E），根据'劣弧定向'原则，应向东航行。",
        startPoint: { lat: 40, lon: 100 },
        targetPoint: { lat: 40, lon: 120 },
        options: [
            { id: 'A', text: "A. 正东", correct: true },
            { id: 'B', text: "B. 正西" },
            { id: 'C', text: "C. 东北" },
            { id: 'D', text: "D. 西北" }
        ]
    },
    4: {
        type: 'choice',
        title: "④ 第四关：跨越重洋 - 斜方向判读",
        story: "✈️ 跨国航班即将起飞，请规划飞行航向。",
        mission: "🌏 城市 A（北京）： 约 (40°N, 116°E)\n城市 B（新加坡）： 约 (1°N, 104°E)\n\n城市 B 位于城市 A 的什么方向？",
        hint: "💡 提示：纬度对比：1°N < 40°N → B 在 A 的南方。经度对比：104°E < 116°E → B 在 A 的西方。结论：西南方向。",
        startPoint: { lat: 40, lon: 116 },
        targetPoint: { lat: 1, lon: 104 },
        options: [
            { id: 'A', text: "A. 东南" },
            { id: 'B', text: "B. 西南", correct: true },
            { id: 'C', text: "C. 东北" },
            { id: 'D', text: "D. 西北" }
        ]
    },
    5: {
        type: 'choice',
        title: "⑤ 第五关：时空追捕 - 动态推演",
        story: "🛸 目标正在移动！它从起点出发，先向正南飞越了 20 个纬度，又向正东飞越了 30 个经度。",
        mission: "📍 起点 A 坐标为 (30°N, 20°W)。\n请计算目标的最终坐标是？",
        hint: "💡 提示：向正南 20 个纬度 → 30°N - 20° = 10°N。向正东 30 个经度 → 20°W 向东跨过 0° 经线 → 到达 10°E。",
        startPoint: { lat: 30, lon: -20 },
        options: [
            { id: 'A', text: "A. (10°N, 10°E)", correct: true },
            { id: 'B', text: "B. (50°N, 50°W)" },
            { id: 'C', text: "C. (10°N, 50°W)" },
            { id: 'D', text: "D. (50°N, 10°E)" }
        ],
        animation: true  // 需要动画演示
    }
};

// 设置游戏事件监听器
function setupGameEventListeners() {
    // 关卡按钮
    document.getElementById('startLevel1Btn').addEventListener('click', () => startLevel(1));
    document.getElementById('startLevel2Btn').addEventListener('click', () => startLevel(2));
    document.getElementById('startLevel3Btn').addEventListener('click', () => startLevel(3));
    document.getElementById('startLevel4Btn').addEventListener('click', () => startLevel(4));
    document.getElementById('startLevel5Btn').addEventListener('click', () => startLevel(5));
    
    // 返回主菜单
    document.getElementById('backToMenuBtn').addEventListener('click', backToMenu);
    
    // 提交答案
    document.getElementById('submitAnswerBtn').addEventListener('click', checkLevelAnswer);
    
    // 显示提示
    document.getElementById('showHintBtn').addEventListener('click', showHint);
    
    // 选项按钮事件
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 移除所有选项的selected状态
            document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            // 添加当前选项的selected状态
            this.classList.add('selected');
            selectedOption = this.getAttribute('data-option');
            console.log(`选中选项: ${selectedOption}`);
        });
    });
    
    console.log('游戏事件监听器已设置');
}

// 开始关卡
function startLevel(level) {
    currentLevel = level;
    hintShown = false;
    currentAnswer = null;
    selectedOption = null;
    
    const config = gameLevels[level];
    
    // 隐藏主菜单，显示关卡界面
    document.getElementById('gameMenuPanel').style.display = 'none';
    document.getElementById('gameLevelPanel').style.display = 'block';
    
    // 设置关卡信息
    document.getElementById('levelTitle').textContent = config.title;
    document.getElementById('storyText').textContent = config.story;
    document.getElementById('missionText').textContent = config.mission;
    document.getElementById('hintText').textContent = config.hint;
    
    // 隐藏提示
    document.querySelector('.hint-box').classList.remove('show');
    
    // 清空之前的标记
    markers.forEach(marker => scene.remove(marker));
    markers = [];
    
    // 根据关卡类型显示不同的UI元素
    const optionsContainer = document.getElementById('optionsContainer');
    const realtimeCoords = document.getElementById('realtimeCoords');
    const submitBtn = document.getElementById('submitAnswerBtn');
    
    if (config.type === 'choice') {
        // 选择题：显示选项按钮，隐藏实时坐标
        optionsContainer.style.display = 'grid';
        realtimeCoords.style.display = 'none';
        submitBtn.textContent = '✅ 提交答案';
        
        // 设置选项内容
        const optionBtns = document.querySelectorAll('.option-btn');
        config.options.forEach((opt, index) => {
            optionBtns[index].textContent = opt.text;
            optionBtns[index].setAttribute('data-option', opt.id);
            optionBtns[index].classList.remove('selected', 'correct', 'wrong');
        });
        
        // 在地球上标记目标点（第1、3、4关）
        if (config.targetPoint) {
            const { lat, lon } = config.targetPoint;
            markPointOnEarth(lat, lon, 0xff0000);  // 红色标记
        }
        
        // 如果有起点，也标记起点（第3、4、5关）
        if (config.startPoint) {
            const { lat, lon } = config.startPoint;
            markPointOnEarth(lat, lon, 0x00ff00);  // 绿色标记起点
        }
        
        document.getElementById('gameFeedbackText').textContent = '请选择正确答案，然后点击"提交答案"。';
        gameActive = false;  // 选择题不需要点击地球
        
    } else if (config.type === 'operate') {
        // 操作题：隐藏选项按钮，显示实时坐标（如果需要）
        optionsContainer.style.display = 'none';
        realtimeCoords.style.display = config.showRealtimeCoords ? 'block' : 'none';
        submitBtn.textContent = '✅ 确认投放';
        
        document.getElementById('gameFeedbackText').textContent = '请点击地球上的目标位置，然后点击"确认投放"。';
        gameActive = true;  // 操作题需要点击地球
        
        // 如果需要实时坐标，设置鼠标移动监听
        if (config.showRealtimeCoords) {
            setupMouseCoordinates();
        }
    }
    
    console.log(`关卡 ${level} (${config.type}) 开始`);
}

// 返回主菜单
function backToMenu() {
    document.getElementById('gameLevelPanel').style.display = 'none';
    document.getElementById('gameMenuPanel').style.display = 'block';
    
    // 清空标记
    markers.forEach(marker => scene.remove(marker));
    markers = [];
    
    gameActive = false;
    currentLevel = 0;
    currentAnswer = null;
}

// 显示提示
function showHint() {
    document.querySelector('.hint-box').classList.add('show');
    hintShown = true;
}

// 在地球上标记点（用于游戏关卡）
function markPointOnEarth(lat, lon, color = 0xff0000) {
    if (is3DView) {
        // 3D模式：球体坐标转换
        let threeLon;
        if (lon >= 0) {
            threeLon = 360 - lon;
        } else {
            threeLon = -lon;
        }
        
        // 转换为弧度
        const phi = (90 - lat) * Math.PI / 180;
        const theta = threeLon * Math.PI / 180;
        
        // 计算位置
        const x = Math.sin(phi) * Math.cos(theta) * 1.05;
        const y = Math.cos(phi) * 1.05;
        const z = Math.sin(phi) * Math.sin(theta) * 1.05;
        
        // 创建球体标记
        const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: color });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(x, y, z);
        
        scene.add(marker);
        markers.push(marker);
        
    } else {
        // 2D模式：平面坐标映射
        const x = (lon / 180) * 3;
        const z = -(lat / 90) * 1.5;  // 负号翻转，与经纬网一致
        const y = 0.02;
        
        // 创建圆形标记
        const markerGeometry = new THREE.CircleGeometry(0.08, 32);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: color,
            side: THREE.DoubleSide
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(x, y, z);
        marker.rotation.x = -Math.PI / 2;  // 水平放置
        
        scene.add(marker);
        markers.push(marker);
    }
    
    console.log(`标记点: (${lat}°, ${lon}°), 颜色: ${color.toString(16)}, 模式: ${is3DView ? '3D' : '2D'}`);
}

// 重新绘制游戏标记点（切换视图时调用）
function redrawGameMarkers() {
    // 清除现有标记
    markers.forEach(marker => scene.remove(marker));
    markers = [];
    
    // 根据当前关卡重新绘制标记
    const config = gameLevels[currentLevel];
    if (!config) return;
    
    // 绘制目标点（红色）
    if (config.targetPoint) {
        const { lat, lon } = config.targetPoint;
        markPointOnEarth(lat, lon, 0xff0000);
    }
    
    // 绘制起点（绿色）
    if (config.startPoint) {
        const { lat, lon } = config.startPoint;
        markPointOnEarth(lat, lon, 0x00ff00);
    }
    
    console.log(`重新绘制关卡 ${currentLevel} 的标记点`);
}

// 设置鼠标实时坐标显示（第二关）
function setupMouseCoordinates() {
    const canvas = document.getElementById('earthCanvas');
    const mouseCoords = document.getElementById('mouseCoords');
    
    canvas.addEventListener('mousemove', function(event) {
        if (!is3DView) return;  // 只在3D视图下显示
        
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObject(earth);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            // 转换为经纬度
            const lat = 90 - (Math.acos(point.y) * 180 / Math.PI);
            const lon = -(Math.atan2(point.z, point.x) * 180 / Math.PI);
            
            const latDir = lat >= 0 ? 'N' : 'S';
            const lonDir = lon >= 0 ? 'E' : 'W';
            
            mouseCoords.textContent = `${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir}`;
        } else {
            mouseCoords.textContent = '--';
        }
    });
}

// 检查关卡答案
function checkLevelAnswer() {
    const config = gameLevels[currentLevel];
    
    if (config.type === 'choice') {
        // 选择题：检查选中的选项
        if (!selectedOption) {
            document.getElementById('gameFeedbackText').textContent = '⚠️ 请先选择一个答案！';
            return;
        }
        
        // 找到正确答案
        const correctOption = config.options.find(opt => opt.correct);
        
        if (selectedOption === correctOption.id) {
            // 答对了
            const selectedBtn = document.querySelector(`.option-btn[data-option="${selectedOption}"]`);
            selectedBtn.classList.remove('selected');
            selectedBtn.classList.add('correct');
            
            handleLevelSuccess(currentLevel);
        } else {
            // 答错了
            const selectedBtn = document.querySelector(`.option-btn[data-option="${selectedOption}"]`);
            const correctBtn = document.querySelector(`.option-btn[data-option="${correctOption.id}"]`);
            
            selectedBtn.classList.remove('selected');
            selectedBtn.classList.add('wrong');
            correctBtn.classList.add('correct');
            
            handleChoiceError(currentLevel, selectedOption, correctOption.id);
        }
        
    } else if (config.type === 'operate') {
        // 操作题：检查点击的位置
        if (!currentAnswer) {
            document.getElementById('gameFeedbackText').textContent = '⚠️ 请先点击地球上的位置，然后再确认投放！';
            return;
        }
        
        const { lat: ansLat, lon: ansLon } = config.answer;
        const { lat: userLat, lon: userLon } = currentAnswer;
        
        // 计算距离
        const dLat = ansLat - userLat;
        const dLon = ansLon - userLon;
        const distance = Math.sqrt(dLat * dLat + dLon * dLon);
        
        console.log(`答案: (${ansLat}, ${ansLon}), 用户: (${userLat.toFixed(1)}, ${userLon.toFixed(1)}), 距离: ${distance.toFixed(1)}`);
        
        if (distance < config.tolerance) {
            // 通关成功
            handleLevelSuccess(currentLevel);
        } else {
            // 给出错误反馈
            handleOperateError(currentLevel, userLat, userLon, ansLat, ansLon);
        }
    }
}

// 关卡成功
function handleLevelSuccess(level) {
    if (!passedLevels.includes(level)) {
        passedLevels.push(level);
        document.getElementById('passedLevels').textContent = passedLevels.length;
    }
    
    let successMessage = '';
    switch(level) {
        case 1:
            successMessage = '🎉 正确！点 P 的坐标是 (20°N, 40°E)。它在赤道以北，本初子午线以东。新兵训练完成！';
            break;
        case 2:
            successMessage = '🎉 准确命中！你成功定位到 30°S, 60°W，这里是南美洲附近的大西洋海域。物资投放成功！';
            break;
        case 3:
            successMessage = '🎉 正确！终点 B 的确位于起点 A 的正东方。两点纬度相同，B 的经度更大，因此向东航行。直线导航成功！';
            break;
        case 4:
            successMessage = '🎉 完全正确！新加坡位于北京的西南方。纬度更低（南），经度更小（西）。跨洋航线规划成功！';
            break;
        case 5:
            successMessage = '🎆 完美！目标最终坐标为 (10°N, 10°E)。向南 20° 后为 10°N，向东 30° 穿过本初子午线到达 10°E。动态追踪成功！';
            break;
    }
    
    // 检查是否全部通关
    if (passedLevels.length === 5) {
        successMessage += '<br><br>🏆 <strong>恭喜通关所有关卡！你是真正的GPS大师！</strong><br>🌟 你已完全掌握经纬度的核心知识！';
    }
    
    // 添加返回按钮提示
    successMessage += '<br><br>👆 点击上方"返回主菜单"继续挑战其他关卡。';
    
    document.getElementById('gameFeedbackText').innerHTML = successMessage;
}

// 选择题错误反馈
function handleChoiceError(level, selectedOpt, correctOpt) {
    let errorMessage = '';
    
    switch(level) {
        case 1:
            if (selectedOpt === 'A') {
                errorMessage = '❌ 错误！P 点在本初子午线以东，应该是东经(E)，而不是西经(W)。请注意，<strong>本初子午线是黄色粗线</strong>。';
            } else if (selectedOpt === 'B') {
                errorMessage = '❌ 错误！P 点在赤道以北，应该是北纬(N)，而不是南纬(S)。请注意，<strong>赤道是红色粗线</strong>。';
            } else if (selectedOpt === 'D') {
                errorMessage = '❌ 错误！经纬度的顺序是：先纬度，后经度。正确答案应该是 (20°N, 40°E)。';
            }
            break;
            
        case 3:
            if (selectedOpt === 'B') {
                errorMessage = '❌ 错误！两点纬度相同(40°N)，说明在同一条纬线上。B 的经度(120°E)大于 A(100°E)，所以应该向<strong>东</strong>航行。';
            } else if (selectedOpt === 'C' || selectedOpt === 'D') {
                errorMessage = '❌ 错误！两点纬度完全相同，都在 40°N，说明是<strong>水平方向</strong>，不可能有北南偏移。正确答案是正东。';
            }
            break;
            
        case 4:
            if (selectedOpt === 'A') {
                errorMessage = '❌ 错误！新加坡(104°E) 的经度<strong>小于</strong>北京(116°E)，说明新加坡在北京的<strong>西方</strong>，不是东方。';
            } else if (selectedOpt === 'C') {
                errorMessage = '❌ 错误！新加坡(1°N) 的纬度<strong>小于</strong>北京(40°N)，说明新加坡在北京的<strong>南方</strong>，不是北方。';
            } else if (selectedOpt === 'D') {
                errorMessage = '❌ 错误！北南方向判断正确（南），但东西方向错误。新加坡(104°E) < 北京(116°E)，应该是<strong>西</strong>南。';
            }
            break;
            
        case 5:
            if (selectedOpt === 'B') {
                errorMessage = '❌ 错误！向正南移动时，纬度应该<strong>减小</strong>，而不是增大。正确算法：30°N - 20° = 10°N。';
            } else if (selectedOpt === 'C') {
                errorMessage = '❌ 错误！纬度计算正确，但经度计算错误。从 20°W 向东 30°，需要<strong>跨过本初子午线(0°)</strong>，到达 10°E。';
            } else if (selectedOpt === 'D') {
                errorMessage = '❌ 错误！经度计算正确，但纬度计算错误。向南移动时纬度减小：30°N - 20° = 10°N。';
            }
            break;
    }
    
    document.getElementById('gameFeedbackText').innerHTML = errorMessage + '<br><br>💡 正确答案已高亮显示为绿色。';
}

// 操作题错误反馈
function handleOperateError(level, userLat, userLon, ansLat, ansLon) {
    let errorMessage = '';
    
    // 只有第2关是操作题
    if (level === 2) {
        // 第二关：判断是东经还是南纬错误
        if (userLon > 0 && Math.abs(userLat + 30) < 15) {
            errorMessage = '🚫 定位失败！你位于东半球，但目标在西半球。请注意"W"代表西经，向西穿越本初子午线！';
        } else if (userLat > 0) {
            errorMessage = '🧭 方向错误！目标在南半球，你现在位于北半球，请跨越赤道向南寻找！';
        } else {
            errorMessage = `📍 位置不准！目标是 30°S, 60°W，你点击的是 ${Math.abs(userLat).toFixed(1)}°${userLat >= 0 ? 'N' : 'S'}, ${Math.abs(userLon).toFixed(1)}°${userLon >= 0 ? 'E' : 'W'}。请继续调整！`;
        }
    }
    
    document.getElementById('gameFeedbackText').innerHTML = errorMessage;
}

// 显示对跖点连线（第三关）
function showAntipodeLine(lat1, lon1, lat2, lon2) {
    // 计算两个点的Three.js坐标
    function getPosition(lat, lon) {
        let threeLon = lon >= 0 ? 360 - lon : -lon;
        const phi = (90 - lat) * Math.PI / 180;
        const theta = threeLon * Math.PI / 180;
        return new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
        );
    }
    
    const pos1 = getPosition(lat1, lon1);
    const pos2 = getPosition(lat2, lon2);
    
    // 创建一条直线连接两个点（穿过地球内部）
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([pos1, pos2]);
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xff00ff, 
        linewidth: 3,
        transparent: true,
        opacity: 0.8
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);
    
    // 3秒后移除
    setTimeout(() => scene.remove(line), 3000);
}