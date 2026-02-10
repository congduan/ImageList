// content.js - 提取当前网页中的所有图片

/**
 * 解析SVG内容获取尺寸信息
 * @param {string} svgContent SVG XML内容
 * @return {Object} 包含width和height的对象
 */
function parseSvgDimensions(svgContent) {
  try {
    // 创建临时DOM元素解析SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    
    if (svgElement) {
      // 尝试从width和height属性获取尺寸
      let width = svgElement.getAttribute('width');
      let height = svgElement.getAttribute('height');
      
      // 如果没有明确的尺寸，尝试从viewBox属性推断
      if (!width || !height) {
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
          const viewBoxParts = viewBox.split(/\s+/).filter(part => part);
          if (viewBoxParts.length >= 4) {
            width = viewBoxParts[2];
            height = viewBoxParts[3];
          }
        }
      }
      
      // 转换为数字
      const widthNum = parseSvgLength(width);
      const heightNum = parseSvgLength(height);
      
      if (widthNum > 0 && heightNum > 0) {
        return { width: widthNum, height: heightNum };
      }
    }
  } catch (error) {
    console.warn('解析SVG尺寸失败:', error);
  }
  
  return { width: 0, height: 0 };
}

/**
 * 解析SVG长度值
 * @param {string} length SVG长度字符串
 * @return {number} 解析后的长度值
 */
function parseSvgLength(length) {
  if (!length) return 0;
  
  // 移除单位
  const numMatch = length.match(/([\d.]+)/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    return isNaN(num) ? 0 : num;
  }
  
  return 0;
}

/**
 * 从SVG URL获取尺寸信息
 * @param {string} url SVG URL
 * @return {Promise<Object>} 包含width和height的对象
 */
async function getSvgDimensionsFromUrl(url) {
  try {
    if (url.startsWith('data:image/svg+xml')) {
      // 处理data URL形式的SVG
      const encodedSvg = url.split(',')[1];
      const decodedSvg = decodeURIComponent(encodedSvg);
      return parseSvgDimensions(decodedSvg);
    } else {
      // 处理普通URL形式的SVG
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const svgContent = await response.text();
        return parseSvgDimensions(svgContent);
      }
    }
  } catch (error) {
    console.warn('从URL获取SVG尺寸失败:', url, error);
  }
  
  return { width: 0, height: 0 };
}

/**
 * 通过magic number检测图片类型
 * @param {ArrayBuffer} buffer 图片文件的ArrayBuffer
 * @return {string} 图片类型
 */
function detectImageTypeByMagicNumber(buffer) {
  const view = new DataView(buffer);
  
  // 检测JPEG
  if (view.byteLength >= 2 && view.getUint8(0) === 0xFF && view.getUint8(1) === 0xD8) {
    return 'jpg';
  }
  
  // 检测PNG
  if (view.byteLength >= 8 && 
      view.getUint8(0) === 0x89 && 
      view.getUint8(1) === 0x50 && 
      view.getUint8(2) === 0x4E && 
      view.getUint8(3) === 0x47 && 
      view.getUint8(4) === 0x0D && 
      view.getUint8(5) === 0x0A && 
      view.getUint8(6) === 0x1A && 
      view.getUint8(7) === 0x0A) {
    return 'png';
  }
  
  // 检测GIF
  if (view.byteLength >= 6 && 
      ((view.getUint8(0) === 0x47 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x46) ||
       (view.getUint8(0) === 0x47 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x66))) {
    return 'gif';
  }
  
  // 检测BMP
  if (view.byteLength >= 2 && 
      view.getUint8(0) === 0x42 && 
      view.getUint8(1) === 0x4D) {
    return 'bmp';
  }
  
  // 检测WebP
  if (view.byteLength >= 12 && 
      view.getUint8(0) === 0x52 && 
      view.getUint8(1) === 0x49 && 
      view.getUint8(2) === 0x46 && 
      view.getUint8(3) === 0x46 && 
      view.getUint8(8) === 0x57 && 
      view.getUint8(9) === 0x45 && 
      view.getUint8(10) === 0x42 && 
      view.getUint8(11) === 0x50) {
    return 'webp';
  }
  
  // 检测AVIF
  if (view.byteLength >= 12 && 
      view.getUint32(4) === 0x41564946 && // 'AVIF' in ASCII
      view.getUint32(8) === 0x312E30) {    // '1.0' in ASCII
    return 'avif';
  }
  
  // 检测ICO
  if (view.byteLength >= 6 && 
      view.getUint16(0) === 0 && 
      view.getUint16(2) === 1) {
    return 'ico';
  }
  
  // 检测TIFF
  if (view.byteLength >= 4 && 
      ((view.getUint16(0) === 0x4D4D && view.getUint16(2) === 42) || // Big-endian
       (view.getUint16(0) === 0x4949 && view.getUint16(2) === 42))) { // Little-endian
    return 'tiff';
  }
  
  return 'unknown';
}

/**
 * 尝试通过fetch获取图片并检测其类型
 * @param {string} url 图片URL
 * @return {Promise<string>} 图片类型
 */
async function getImageTypeByFetch(url) {
  try {
    // 尝试多种fetch配置
    const fetchConfigs = [
      {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      },
      {
        method: 'GET',
        mode: 'no-cors',
        cache: 'default'
      }
    ];
    
    let response;
    for (const config of fetchConfigs) {
      try {
        response = await fetch(url, config);
        if (response.ok || response.type === 'opaque') {
          break;
        }
      } catch (error) {
        // 尝试下一个配置
        continue;
      }
    }
    
    if (!response) {
      throw new Error('所有fetch配置都失败');
    }
    
    // 对于no-cors请求，我们无法获取响应体，但可以从其他信息推断
    if (response.type === 'opaque') {
      // 尝试从Content-Type头推断类型
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.startsWith('image/')) {
        const typeMatch = contentType.match(/image\/(.*)/);
        if (typeMatch) {
          const type = typeMatch[1].toLowerCase();
          // 处理常见的MIME类型
          if (type === 'jpeg') return 'jpg';
          if (['jpg', 'png', 'gif', 'webp', 'bmp', 'svg+xml', 'avif', 'tiff', 'ico'].includes(type)) {
            return type.replace('+xml', '');
          }
        }
      }
      throw new Error('无法获取响应体');
    }
    
    const buffer = await response.arrayBuffer();
    return detectImageTypeByMagicNumber(buffer);
  } catch (error) {
    console.warn('通过fetch检测图片类型失败:', url, error);
    
    // 最后尝试：从URL路径和参数中推断类型
    const urlLower = url.toLowerCase();
    if (urlLower.includes('image/jpeg') || urlLower.includes('image/jpg')) return 'jpg';
    if (urlLower.includes('image/png')) return 'png';
    if (urlLower.includes('image/gif')) return 'gif';
    if (urlLower.includes('image/webp')) return 'webp';
    if (urlLower.includes('image/bmp')) return 'bmp';
    if (urlLower.includes('image/svg')) return 'svg';
    if (urlLower.includes('image/avif')) return 'avif';
    if (urlLower.includes('image/tiff')) return 'tiff';
    if (urlLower.includes('image/ico')) return 'ico';
    
    return 'unknown';
  }
}

/**
 * 提取网页中的所有图片
 * @return {Array} 图片信息数组
 */
function extractImages() {
  const images = [];
  const seenUrls = new Set();

  // 提取img标签中的图片
  const imgElements = document.querySelectorAll('img');
  console.log('找到', imgElements.length, '个img标签');
  for (const img of imgElements) {
    let src = img.src;
    // 处理相对路径
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      src = new URL(src, window.location.href).href;
    }
    if (src && !seenUrls.has(src)) {
      seenUrls.add(src);
      // 尝试获取图片尺寸，优先使用naturalWidth/naturalHeight获取原始尺寸
      let width = 0;
      let height = 0;
      
      // 尝试获取原始尺寸
      if (img.naturalWidth && img.naturalHeight) {
        width = img.naturalWidth;
        height = img.naturalHeight;
      } 
      // 尝试获取当前显示尺寸
      else if (img.width && img.height) {
        width = img.width;
        height = img.height;
      }
      // 尝试从style或属性中获取尺寸
      else {
        // 从style属性中获取
        const styleWidth = img.style.width;
        const styleHeight = img.style.height;
        if (styleWidth) {
          const widthMatch = styleWidth.match(/(\d+)px/);
          if (widthMatch) width = parseInt(widthMatch[1]);
        }
        if (styleHeight) {
          const heightMatch = styleHeight.match(/(\d+)px/);
          if (heightMatch) height = parseInt(heightMatch[1]);
        }
        // 从width/height属性中获取
        if (!width && img.getAttribute('width')) {
          width = parseInt(img.getAttribute('width')) || 0;
        }
        if (!height && img.getAttribute('height')) {
          height = parseInt(img.getAttribute('height')) || 0;
        }
      }
      
      // 先通过URL获取类型，然后尝试通过magic number验证
      let type = getImageType(src);
      
      // 对于可能的图片，尝试通过fetch获取并检测magic number
      if (type === 'unknown' || ['jpg', 'png', 'gif', 'webp', 'bmp', 'avif', 'tiff', 'ico'].includes(type)) {
        // 注意：这里不等待异步操作完成，避免阻塞提取过程
        getImageTypeByFetch(src).then(detectedType => {
          if (detectedType !== 'unknown') {
            // 更新已提取图片的类型
            const existingImage = images.find(img => img.src === src);
            if (existingImage) {
              existingImage.type = detectedType;
            }
          }
        });
      }
      
      images.push({
        src: src,
        alt: img.alt || '',
        width: width,
        height: height,
        type: type,
        elementType: 'img'
      });
    }
  }

  // 提取canvas中的图片
  const canvasElements = document.querySelectorAll('canvas');
  console.log('找到', canvasElements.length, '个canvas元素');
  for (const canvas of canvasElements) {
    try {
      // 尝试获取canvas中的图片数据
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl && dataUrl.startsWith('data:image/') && !seenUrls.has(dataUrl)) {
        seenUrls.add(dataUrl);
        images.push({
          src: dataUrl,
          alt: `Canvas Image ${canvasElements.length}`,
          width: canvas.width,
          height: canvas.height,
          type: 'png',
          elementType: 'canvas'
        });
      }
    } catch (error) {
      console.warn('提取canvas图片失败:', error);
    }
  }

  // 提取CSS背景图片
  const elements = document.querySelectorAll('*');
  console.log('检查', elements.length, '个元素的背景图片');
  for (const element of elements) {
    try {
      const computedStyle = window.getComputedStyle(element);
      const backgroundImage = computedStyle.backgroundImage;
      if (backgroundImage && backgroundImage !== 'none') {
        // 提取背景图片URL
        // 使用更可靠的正则表达式处理各种URL格式
        const urlMatches = backgroundImage.match(/url\((['"]?)(.*?)\1\)/g);
        if (urlMatches) {
          for (const match of urlMatches) {
            // 提取URL内容，处理带引号和不带引号的情况
            let url;
            const quoteMatch = match.match(/url\(['"](.*?)['"]\)/);
            if (quoteMatch) {
              url = quoteMatch[1];
            } else {
              const noQuoteMatch = match.match(/url\((.*?)\)/);
              url = noQuoteMatch ? noQuoteMatch[1] : '';
            }
            
            if (url) {
              // 处理相对路径
              if (!url.startsWith('http') && !url.startsWith('data:')) {
                try {
                  url = new URL(url, window.location.href).href;
                } catch (error) {
                  console.warn('无法解析URL:', url, error);
                  continue;
                }
              }
              
              // 处理data URL中的SVG
              if (url.startsWith('data:image/svg+xml')) {
                // 确保data URL格式正确
                try {
                  // 解码URL编码的SVG内容
                  const decodedUrl = decodeURIComponent(url);
                  if (!seenUrls.has(decodedUrl)) {
                    seenUrls.add(decodedUrl);
                    
                    // 解析SVG尺寸
                    let width = 0;
                    let height = 0;
                    try {
                      const encodedSvg = decodedUrl.split(',')[1];
                      const svgContent = decodeURIComponent(encodedSvg);
                      const dimensions = parseSvgDimensions(svgContent);
                      width = dimensions.width;
                      height = dimensions.height;
                    } catch (error) {
                      console.warn('解析SVG尺寸失败:', error);
                    }
                    
                    images.push({
                      src: decodedUrl,
                      alt: '',
                      width: width,
                      height: height,
                      type: 'svg',
                      elementType: 'background'
                    });
                  }
                } catch (error) {
                  console.warn('处理SVG data URL失败:', error);
                  // 如果解码失败，使用原始URL
                  if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    images.push({
                      src: url,
                      alt: '',
                      width: 0,
                      height: 0,
                      type: 'svg',
                      elementType: 'background'
                    });
                  }
                }
              } else if (url.includes('svg') || url.includes('SVG')) {
                // 对于可能是SVG的URL，尝试进一步检测
                // 使用Promise的then/catch语法，避免在非异步函数中使用await
                fetch(url, {
                  mode: 'cors',
                  cache: 'no-cache'
                }).then(response => {
                  if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('svg')) {
                      // 确认是SVG文件
                      if (!seenUrls.has(url)) {
                        seenUrls.add(url);
                        
                        // 尝试获取SVG内容解析尺寸
                        let width = 0;
                        let height = 0;
                        response.text().then(svgContent => {
                          try {
                            const dimensions = parseSvgDimensions(svgContent);
                            width = dimensions.width;
                            height = dimensions.height;
                          } catch (error) {
                            console.warn('解析SVG内容失败:', error);
                          }
                          
                          images.push({
                            src: url,
                            alt: '',
                            width: width,
                            height: height,
                            type: 'svg',
                            elementType: 'background'
                          });
                        }).catch(error => {
                          console.warn('获取SVG内容失败:', error);
                          // 即使失败，也添加为SVG图片
                          images.push({
                            src: url,
                            alt: '',
                            width: 0,
                            height: 0,
                            type: 'svg',
                            elementType: 'background'
                          });
                        });
                      }
                    }
                  }
                }).catch(error => {
                  console.warn('检测SVG失败:', error);
                  // 即使失败，也尝试添加为普通图片
                  if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    images.push({
                      src: url,
                      alt: '',
                      width: 0,
                      height: 0,
                      type: getImageType(url),
                      elementType: 'background'
                    });
                  }
                });
              } else {
                // 处理普通URL
                if (!seenUrls.has(url)) {
                  seenUrls.add(url);
                  // 先通过URL获取类型，然后尝试通过magic number验证
                  let type = getImageType(url);
                  
                  // 对于SVG，尝试解析尺寸
                  let width = 0;
                  let height = 0;
                  if (type === 'svg') {
                    // 注意：这里不等待异步操作完成，避免阻塞提取过程
                    getSvgDimensionsFromUrl(url).then(dimensions => {
                      if (dimensions.width > 0 && dimensions.height > 0) {
                        // 更新已提取图片的尺寸
                        const existingImage = images.find(img => img.src === url);
                        if (existingImage) {
                          existingImage.width = dimensions.width;
                          existingImage.height = dimensions.height;
                        }
                      }
                    });
                  }
                  
                  // 对于可能的图片，尝试通过fetch获取并检测magic number
                  if (type === 'unknown' || ['jpg', 'png', 'gif', 'webp', 'bmp', 'avif', 'tiff', 'ico'].includes(type)) {
                    // 注意：这里不等待异步操作完成，避免阻塞提取过程
                    getImageTypeByFetch(url).then(detectedType => {
                      if (detectedType !== 'unknown') {
                        // 更新已提取图片的类型
                        const existingImage = images.find(img => img.src === url);
                        if (existingImage) {
                          existingImage.type = detectedType;
                        }
                      }
                    });
                  }
                  
                  images.push({
                    src: url,
                    alt: '',
                    width: width,
                    height: height,
                    type: type,
                    elementType: 'background'
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      // 忽略无法访问的元素
      console.warn('无法获取元素样式:', error);
    }
  }

  console.log('提取到', images.length, '张图片');
  return images;
}

/**
 * 获取图片类型
 * @param {string} url 图片URL
 * @return {string} 图片类型
 */
function getImageType(url) {
  if (url.startsWith('data:image/')) {
    const typeMatch = url.match(/data:image\/(.*?);/);
    return typeMatch ? typeMatch[1] : 'base64';
  }
  
  // 尝试从URL路径中提取文件扩展名
  // 处理URL参数和哈希部分
  const cleanUrl = url.split('?')[0].split('#')[0];
  
  // 提取扩展名，处理各种情况
  let extension = '';
  
  // 方法1：从URL末尾提取扩展名
  const extensionMatch = cleanUrl.match(/\.([^.]+)$/);
  if (extensionMatch) {
    extension = extensionMatch[1].toLowerCase();
  }
  
  // 方法2：如果没有找到扩展名，尝试从URL路径中查找图片格式关键词
  const urlLower = url.toLowerCase();
  if (!extension) {
    if (urlLower.includes('jpg') || urlLower.includes('jpeg')) {
      return 'jpg';
    } else if (urlLower.includes('png')) {
      return 'png';
    } else if (urlLower.includes('svg')) {
      return 'svg';
    } else if (urlLower.includes('webp')) {
      return 'webp';
    } else if (urlLower.includes('gif')) {
      return 'gif';
    } else if (urlLower.includes('bmp')) {
      return 'bmp';
    } else if (urlLower.includes('ico')) {
      return 'ico';
    } else if (urlLower.includes('tiff') || urlLower.includes('tif')) {
      return 'tiff';
    } else if (urlLower.includes('apng')) {
      return 'apng';
    } else if (urlLower.includes('avif')) {
      return 'avif';
    }
  } else {
    // 处理找到的扩展名
    extension = extension.toLowerCase();
    // 统一处理jpeg和jpg
    if (extension === 'jpeg') {
      return 'jpg';
    }
    // 支持更多图片格式
    if (['jpg', 'png', 'svg', 'webp', 'gif', 'bmp', 'ico', 'tiff', 'tif', 'apng', 'avif'].includes(extension)) {
      return extension;
    }
  }
  
  // 最后尝试：检查URL中是否包含图片格式的MIME类型或其他线索
  if (urlLower.includes('image/jpeg') || urlLower.includes('image/jpg')) {
    return 'jpg';
  }
  if (urlLower.includes('image/png')) {
    return 'png';
  }
  if (urlLower.includes('image/svg')) {
    return 'svg';
  }
  if (urlLower.includes('image/webp')) {
    return 'webp';
  }
  if (urlLower.includes('image/gif')) {
    return 'gif';
  }
  
  return 'unknown';
}

/**
 * 处理来自background script的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractImages') {
    const images = extractImages();
    sendResponse({ images: images });
  } else if (request.action === 'getCachedImage') {
    // 尝试从缓存获取图片数据
    try {
      // 从localStorage获取图片数据
      const storedImages = localStorage.getItem('pageImages');
      if (storedImages) {
        try {
          const images = JSON.parse(storedImages);
          const cachedImage = images.find(img => img.src === request.url);
          
          if (cachedImage && cachedImage.src) {
            // 检查是否为SVG
            if (cachedImage.src.includes('.svg') || cachedImage.src.includes('svg+xml')) {
              // 对于SVG，无论缓存如何，都直接从原始URL获取完整内容
              try {
                let svgUrl = cachedImage.src;
                // 如果是data URL，尝试从DOM中找到原始img元素获取真实URL
                if (svgUrl.includes('data:image/svg+xml')) {
                  const imgElements = document.querySelectorAll('img');
                  const imgElement = Array.from(imgElements).find(img => img.src === request.url);
                  if (imgElement) {
                    svgUrl = imgElement.src;
                  }
                }
                
                // 确保使用真实的SVG URL
                if (svgUrl.includes('data:image/svg+xml')) {
                  // 如果仍然是data URL，尝试从其中提取SVG内容
                  try {
                    const encodedSvg = svgUrl.split(',')[1];
                    if (encodedSvg) {
                      const svgContent = decodeURIComponent(encodedSvg);
                      sendResponse({ 
                        success: true, 
                        dataUrl: svgUrl 
                      });
                      return true;
                    }
                  } catch (error) {
                    console.warn('解析SVG data URL失败:', error);
                  }
                }
                
                // 从真实URL获取SVG内容
                fetch(svgUrl)
                  .then(response => {
                    if (response.ok) {
                      return response.text();
                    }
                    throw new Error('Network response was not ok');
                  })
                  .then(svgContent => {
                    // 创建完整的SVG data URL
                    const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgContent);
                    sendResponse({ 
                      success: true, 
                      dataUrl: dataUrl 
                    });
                  })
                  .catch(error => {
                    console.warn('获取SVG内容失败:', error);
                    // 如果获取失败，尝试使用缓存的src
                    if (cachedImage.src) {
                      sendResponse({ 
                        success: true, 
                        dataUrl: cachedImage.src 
                      });
                    } else {
                      sendResponse({ success: false, error: '无法获取SVG内容' });
                    }
                  });
                return true;
              } catch (error) {
                console.warn('处理SVG失败:', error);
                // 如果处理失败，尝试使用缓存的src
                if (cachedImage.src) {
                  sendResponse({ 
                    success: true, 
                    dataUrl: cachedImage.src 
                  });
                } else {
                  sendResponse({ success: false, error: '无法处理SVG' });
                }
                return true;
              }
            } else {
              // 非SVG图片，直接返回缓存
              sendResponse({ 
                success: true, 
                dataUrl: cachedImage.src 
              });
              return true;
            }
          }
        } catch (error) {
          console.error('解析localStorage数据失败:', error);
          // localStorage数据可能损坏，继续从DOM获取
        }
      }
      
      // 尝试直接从DOM中获取图片
      const imgElements = document.querySelectorAll('img');
      for (const img of imgElements) {
        if (img.src === request.url) {
          // 检查是否为SVG
          if (img.src.includes('.svg') || img.src.includes('svg+xml')) {
            // 对于SVG，尝试直接获取原始内容
            try {
              fetch(img.src)
                .then(response => {
                  if (response.ok) {
                    return response.text();
                  }
                  throw new Error('Network response was not ok');
                })
                .then(svgContent => {
                  // 创建SVG data URL
                  const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgContent);
                  sendResponse({ 
                    success: true, 
                    dataUrl: dataUrl 
                  });
                })
                .catch(error => {
                  console.warn('获取SVG内容失败:', error);
                  // 如果获取失败，使用原始src
                  sendResponse({ 
                    success: true, 
                    dataUrl: img.src 
                  });
                });
              return true;
            } catch (error) {
              console.warn('处理SVG失败:', error);
              // 如果处理失败，使用原始src
              sendResponse({ 
                success: true, 
                dataUrl: img.src 
              });
              return true;
            }
          } else {
            // 对于非SVG图片，使用canvas转换
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.width || 100;
              canvas.height = img.height || 100;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              sendResponse({ 
                success: true, 
                dataUrl: dataUrl 
              });
              return true;
            } catch (error) {
              console.warn('转换图片为data URL失败:', error);
              // 如果转换失败，使用原始src
              sendResponse({ 
                success: true, 
                dataUrl: img.src 
              });
              return true;
            }
          }
        }
      }
      
      // 未找到缓存
      sendResponse({ success: false, error: '未找到缓存的图片' });
    } catch (error) {
      console.error('获取缓存图片失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  return true;
});

// 当页面加载完成时提取图片
window.addEventListener('load', () => {
  const images = extractImages();
  // 存储图片信息到localStorage，供侧边栏使用
  localStorage.setItem('pageImages', JSON.stringify(images));
});

// 当页面DOM变化时重新提取图片
// 使用条件声明，避免重复声明错误
if (!window.imageListObserver) {
  window.imageListObserver = new MutationObserver(() => {
    const images = extractImages();
    localStorage.setItem('pageImages', JSON.stringify(images));
  });

  window.imageListObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}