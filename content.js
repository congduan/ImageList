// content.js - 提取当前网页中的所有图片

/**
 * 解析SVG内容获取尺寸信息
 * @param {string} svgContent SVG XML内容
 * @return {Object} 包含width和height的对象
 */
function parseSvgDimensions(svgContent) {
  try {
    // 清理SVG内容，处理可能的编码问题
    let cleanedContent = svgContent;
    try {
      // 尝试解码可能的URL编码
      cleanedContent = decodeURIComponent(svgContent);
    } catch (e) {
      // 解码失败，使用原始内容
    }

    // 清理SVG内容中的反引号和HTML注释
    cleanedContent = cleanedContent.replace(/`/g, '').replace(/<!--[\s\S]*?-->/g, '');

    // 使用fast-xml-parser库解析SVG
    if (typeof fxp !== 'undefined' && fxp.XMLParser) {
      const parser = new fxp.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        parseAttributeValue: true
      });
      
      try {
        const svgObj = parser.parse(cleanedContent);
        const svgElement = svgObj.svg;
        
        if (svgElement) {
          let width = null;
          let height = null;

          // 方法1：直接从width和height属性获取尺寸
          if (svgElement.width) {
            const widthMatch = svgElement.width.match(/([\d.]+)/);
            if (widthMatch) width = widthMatch[1];
          }
          if (svgElement.height) {
            const heightMatch = svgElement.height.match(/([\d.]+)/);
            if (heightMatch) height = heightMatch[1];
          }

          // 方法2：从viewBox属性推断尺寸
          if (!width || !height) {
            const viewBox = svgElement.viewBox;
            if (viewBox) {
              const viewBoxParts = viewBox.split(/\s+/).filter(part => part);
              if (viewBoxParts.length >= 4) {
                const vbWidth = parseFloat(viewBoxParts[2]);
                const vbHeight = parseFloat(viewBoxParts[3]);
                if (!width) width = vbWidth;
                if (!height) height = vbHeight;
              }
            }
          }

          // 方法3：从style属性获取尺寸
          if (!width || !height) {
            const style = svgElement.style;
            if (style) {
              const widthMatch = style.match(/width:\s*([\d.]+)\s*(px|em|rem|%|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax)?/);
              const heightMatch = style.match(/height:\s*([\d.]+)\s*(px|em|rem|%|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax)?/);
              if (widthMatch && !width) width = widthMatch[1];
              if (heightMatch && !height) height = heightMatch[1];
            }
          }

          // 转换为数字并验证
          const widthNum = width ? parseFloat(width) : 0;
          const heightNum = height ? parseFloat(height) : 0;

          if (widthNum > 0 && heightNum > 0) {
            // 确保尺寸合理（不超过50000x50000）
            const finalWidth = Math.min(Math.max(widthNum, 1), 50000);
            const finalHeight = Math.min(Math.max(heightNum, 1), 50000);
            return { width: Math.round(finalWidth), height: Math.round(finalHeight) };
          }
        }
      } catch (error) {
        console.warn('使用fast-xml-parser解析SVG失败，尝试使用DOMParser:', error);
        // 解析失败，回退到DOMParser方法
      }
    }

    // 回退方案：使用DOMParser解析SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(cleanedContent, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');

    if (svgElement) {
      let width = null;
      let height = null;

      // 方法1：直接从width和height属性获取尺寸
      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');

      if (widthAttr) {
        const widthMatch = widthAttr.match(/([\d.]+)/);
        if (widthMatch) width = widthMatch[1];
      }
      if (heightAttr) {
        const heightMatch = heightAttr.match(/([\d.]+)/);
        if (heightMatch) height = heightMatch[1];
      }

      // 方法2：从viewBox属性推断尺寸
      if (!width || !height) {
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
          const viewBoxParts = viewBox.split(/\s+/).filter(part => part);
          if (viewBoxParts.length >= 4) {
            const vbWidth = parseFloat(viewBoxParts[2]);
            const vbHeight = parseFloat(viewBoxParts[3]);
            if (!width) width = vbWidth;
            if (!height) height = vbHeight;
          }
        }
      }

      // 方法3：从style属性获取尺寸
      if (!width || !height) {
        const style = svgElement.getAttribute('style');
        if (style) {
          const widthMatch = style.match(/width:\s*([\d.]+)\s*(px|em|rem|%|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax)?/);
          const heightMatch = style.match(/height:\s*([\d.]+)\s*(px|em|rem|%|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax)?/);
          if (widthMatch && !width) width = widthMatch[1];
          if (heightMatch && !height) height = heightMatch[1];
        }
      }

      // 方法4：从内联CSS计算
      if (!width || !height) {
        const computedWidth = svgElement.style.width;
        const computedHeight = svgElement.style.height;
        if (computedWidth && !width) {
          const widthMatch = computedWidth.match(/([\d.]+)/);
          if (widthMatch) width = widthMatch[1];
        }
        if (computedHeight && !height) {
          const heightMatch = computedHeight.match(/([\d.]+)/);
          if (heightMatch) height = heightMatch[1];
        }
      }

      // 方法5：检查子元素的边界框来估算尺寸
      if (!width || !height) {
        try {
          const firstPath = svgElement.querySelector('path, rect, circle, ellipse, line, polygon, polyline, text');
          if (firstPath) {
            const bbox = firstPath.getBBox ? firstPath.getBBox() : null;
            if (bbox && bbox.width > 0 && bbox.height > 0) {
              if (!width) width = Math.ceil(bbox.width + 10); // 加一些padding
              if (!height) height = Math.ceil(bbox.height + 10);
            }
          }
        } catch (e) {
          // 忽略getBBox错误
        }
      }

      // 转换为数字并验证
      const widthNum = width ? parseFloat(width) : 0;
      const heightNum = height ? parseFloat(height) : 0;

      if (widthNum > 0 && heightNum > 0) {
        // 确保尺寸合理（不超过50000x50000）
        const finalWidth = Math.min(Math.max(widthNum, 1), 50000);
        const finalHeight = Math.min(Math.max(heightNum, 1), 50000);
        return { width: Math.round(finalWidth), height: Math.round(finalHeight) };
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
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }

  // 处理特殊情况
  if (length === '100%') {
    return 100;
  }
  if (length === '50%') {
    return 50;
  }

  return 0;
}

/**
 * 协调获取图片类型和尺寸信息，避免竞态条件
 * @param {string} url 图片URL
 * @param {Object} initialImage 初始图片信息
 * @return {Promise<Object>} 更新后的图片信息
 */
async function getImageInfoCoordinated(url, initialImage) {
  try {
    // 并行获取类型和尺寸信息
    const [detectedType, dimensions] = await Promise.allSettled([
      getImageTypeByFetch(url),
      initialImage.type === 'svg' ? getSvgDimensionsFromUrl(url) : Promise.resolve({ width: 0, height: 0 })
    ]);

    const updatedImage = { ...initialImage };

    // 更新类型信息
    if (detectedType.status === 'fulfilled' && detectedType.value !== 'unknown') {
      updatedImage.type = detectedType.value;
    }

    // 更新尺寸信息
    if (dimensions.status === 'fulfilled' && dimensions.value.width > 0 && dimensions.value.height > 0) {
      updatedImage.width = dimensions.value.width;
      updatedImage.height = dimensions.value.height;
    }

    return updatedImage;
  } catch (error) {
    console.warn('协调获取图片信息失败:', url, error);
    return initialImage;
  }
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
  try {
    if (!buffer || buffer.byteLength === 0) {
      return 'unknown';
    }

    const view = new DataView(buffer);

    // 检测JPEG
    if (view.byteLength >= 2 && view.getUint8(0) === 0xFF && view.getUint8(1) === 0xD8) {
      // 额外验证JPEG文件尾
      if (view.byteLength >= 4 &&
        view.getUint8(view.byteLength - 2) === 0xFF &&
        view.getUint8(view.byteLength - 1) === 0xD9) {
        return 'jpg';
      }
      return 'jpg'; // 即使没有尾标记也认为是JPEG
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

    // 检测AVIF - 修复检测逻辑
    if (view.byteLength >= 12) {
      // AVIF files start with 'ftyp' box, check for 'avif' or 'avis' brand
      if (view.getUint32(4) === 0x66747970) { // 'ftyp'
        const brand1 = view.getUint32(8);
        const brand2 = view.getUint32(12);
        if (brand1 === 0x61766966 || brand1 === 0x61766973 || // 'avif' or 'avis'
          brand2 === 0x61766966 || brand2 === 0x61766973) {
          return 'avif';
        }
      }
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

    // 检测HEIC/HEIF
    if (view.byteLength >= 12) {
      // HEIC/HEIF files also use 'ftyp' box
      if (view.getUint32(4) === 0x66747970) { // 'ftyp'
        const brand1 = view.getUint32(8);
        const brand2 = view.getUint32(12);
        if (brand1 === 0x68656963 || brand1 === 0x68656966 || // 'heic' or 'heif'
          brand2 === 0x68656963 || brand2 === 0x68656966) {
          return 'heic'; // 统一返回heic，因为浏览器通常不支持heif
        }
      }
    }

    return 'unknown';
  } catch (error) {
    console.warn('Magic number检测失败:', error);
    return 'unknown';
  }
}

/**
 * 验证图片数据完整性
 * @param {ArrayBuffer} buffer 图片数据
 * @param {string} type 图片类型
 * @return {boolean} 是否有效
 */
function validateImageData(buffer, type) {
  try {
    if (!buffer || buffer.byteLength === 0) {
      return false;
    }

    const view = new DataView(buffer);
    const minSize = 100; // 最小文件大小

    switch (type) {
      case 'jpg':
        return buffer.byteLength >= minSize &&
          view.getUint8(0) === 0xFF &&
          view.getUint8(1) === 0xD8;

      case 'png':
        return buffer.byteLength >= minSize &&
          view.getUint8(0) === 0x89 &&
          view.getUint8(1) === 0x50 &&
          view.getUint8(2) === 0x4E &&
          view.getUint8(3) === 0x47;

      case 'gif':
        return buffer.byteLength >= minSize &&
          ((view.getUint8(0) === 0x47 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x46) ||
            (view.getUint8(0) === 0x47 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x66));

      case 'webp':
        return buffer.byteLength >= minSize &&
          view.getUint8(0) === 0x52 &&
          view.getUint8(1) === 0x49 &&
          view.getUint8(2) === 0x46 &&
          view.getUint8(3) === 0x46;

      case 'bmp':
        return buffer.byteLength >= minSize &&
          view.getUint8(0) === 0x42 &&
          view.getUint8(1) === 0x4D;

      default:
        return buffer.byteLength >= minSize;
    }
  } catch (error) {
    return false;
  }

  const view = new DataView(buffer);

  // 检测JPEG
  if (view.byteLength >= 2 && view.getUint8(0) === 0xFF && view.getUint8(1) === 0xD8) {
    // 额外验证JPEG文件尾
    if (view.byteLength >= 4 &&
      view.getUint8(view.byteLength - 2) === 0xFF &&
      view.getUint8(view.byteLength - 1) === 0xD9) {
      return 'jpg';
    }
    return 'jpg'; // 即使没有尾标记也认为是JPEG
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

  // 检测AVIF - 修复检测逻辑
  if (view.byteLength >= 12) {
    // AVIF files start with 'ftyp' box, check for 'avif' or 'avis' brand
    if (view.getUint32(4) === 0x66747970) { // 'ftyp'
      const brand1 = view.getUint32(8);
      const brand2 = view.getUint32(12);
      if (brand1 === 0x61766966 || brand1 === 0x61766973 || // 'avif' or 'avis'
        brand2 === 0x61766966 || brand2 === 0x61766973) {
        return 'avif';
      }
    }
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

  // 检测HEIC/HEIF
  if (view.byteLength >= 12) {
    // HEIC/HEIF files also use 'ftyp' box
    if (view.getUint32(4) === 0x66747970) { // 'ftyp'
      const brand1 = view.getUint32(8);
      const brand2 = view.getUint32(12);
      if (brand1 === 0x68656963 || brand1 === 0x68656966 || // 'heic' or 'heif'
        brand2 === 0x68656963 || brand2 === 0x68656966) {
        return 'heic'; // 统一返回heic，因为浏览器通常不支持heif
      }
    }
  }

  return 'unknown';
}

async function getImageTypeByFetch(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

  try {
    // 尝试多种fetch配置，增加超时和重试机制
    const fetchConfigs = [
      {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        signal: controller.signal
      },
      {
        method: 'GET',
        mode: 'no-cors',
        cache: 'default',
        signal: controller.signal
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

    // 检测lazy-loaded图片
    const dataSrc = img.getAttribute('data-src');
    const dataSrcSet = img.getAttribute('data-srcset');
    const dataOriginal = img.getAttribute('data-original');

    // 优先使用真实的图片URL
    if (dataSrc) {
      src = dataSrc;
    } else if (dataOriginal) {
      src = dataOriginal;
    }

    // 处理相对路径和特殊URL
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      // 处理协议相对URL
      if (src.startsWith('//')) {
        src = window.location.protocol + src;
      } else {
        // 处理普通相对路径
        try {
          src = new URL(src, window.location.href).href;
        } catch (error) {
          console.warn('无法解析URL:', src, error);
          // 尝试简单的路径拼接
          const baseUrl = window.location.href.replace(/[^/]+$/, '');
          src = baseUrl + src;
        }
      }
    }

    // 清理URL中的特殊字符和编码
    try {
      src = decodeURIComponent(src);
    } catch (error) {
      // 忽略解码错误
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
        // 从data属性中获取尺寸
        if (!width && img.getAttribute('data-width')) {
          width = parseInt(img.getAttribute('data-width')) || 0;
        }
        if (!height && img.getAttribute('data-height')) {
          height = parseInt(img.getAttribute('data-height')) || 0;
        }
      }

      // 先通过URL获取类型，然后尝试通过magic number验证
      let type = getImageType(src);

      // 对于SVG类型的图片，尝试直接解析尺寸
      if (type === 'svg' && width === 0 && height === 0) {
        if (src.startsWith('data:image/svg+xml')) {
          // 对于data URL形式的SVG，直接解析
          try {
            const encodedSvg = src.split(',')[1];
            if (encodedSvg) {
              const svgContent = decodeURIComponent(encodedSvg);
              const dimensions = parseSvgDimensions(svgContent);
              if (dimensions.width > 0 && dimensions.height > 0) {
                width = dimensions.width;
                height = dimensions.height;
              }
            }
          } catch (error) {
            console.warn('解析SVG data URL尺寸失败:', error);
          }
        } else {
          // 对于普通URL形式的SVG，尝试通过fetch获取尺寸
          const currentSrc = src;
          fetch(currentSrc, {
            mode: 'cors',
            cache: 'no-cache'
          }).then(response => {
            if (response.ok) {
              return response.text();
            }
            throw new Error('Network response was not ok');
          }).then(svgContent => {
            const dimensions = parseSvgDimensions(svgContent);
            if (dimensions.width > 0 && dimensions.height > 0) {
              // 更新图片尺寸
              const existingImage = images.find(img => img.src === currentSrc);
              if (existingImage) {
                existingImage.width = dimensions.width;
                existingImage.height = dimensions.height;
                // 更新localStorage中的图片尺寸
                try {
                  const storedImages = localStorage.getItem('pageImages');
                  if (storedImages) {
                    const storedImagesArray = JSON.parse(storedImages);
                    const storedImage = storedImagesArray.find(img => img.src === currentSrc);
                    if (storedImage) {
                      storedImage.width = dimensions.width;
                      storedImage.height = dimensions.height;
                      localStorage.setItem('pageImages', JSON.stringify(storedImagesArray));
                    }
                  }
                } catch (error) {
                  console.warn('更新localStorage中的图片尺寸失败:', error);
                }
              }
            }
          }).catch(error => {
            console.warn('通过fetch获取SVG尺寸失败:', currentSrc, error);
          });
        }
      }

      // 对于可能的图片，使用协调函数获取完整的类型和尺寸信息
      if (type === 'unknown' || ['jpg', 'png', 'gif', 'webp', 'bmp', 'avif', 'tiff', 'ico', 'heic'].includes(type)) {
        const currentImage = {
          src: src,
          alt: img.alt || '',
          width: width,
          height: height,
          type: type,
          elementType: 'img'
        };

        // 异步获取完整信息但不阻塞主流程
        getImageInfoCoordinated(src, currentImage).then(updatedImage => {
          if (updatedImage.type !== currentImage.type || updatedImage.width !== currentImage.width || updatedImage.height !== currentImage.height) {
            // 更新已提取图片的信息
            const existingImage = images.find(img => img.src === src);
            if (existingImage) {
              Object.assign(existingImage, updatedImage);

              // 更新localStorage中的图片信息
              try {
                const storedImages = localStorage.getItem('pageImages');
                if (storedImages) {
                  const storedImagesArray = JSON.parse(storedImages);
                  const storedImage = storedImagesArray.find(img => img.src === src);
                  if (storedImage) {
                    Object.assign(storedImage, updatedImage);
                    localStorage.setItem('pageImages', JSON.stringify(storedImagesArray));
                  }
                }
              } catch (error) {
                console.warn('更新localStorage中的图片信息失败:', error);
              }
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

    // 处理data-srcset属性
    if (dataSrcSet) {
      const sources = dataSrcSet.split(',').map(item => {
        const parts = item.trim().split(' ');
        return parts[0];
      });

      sources.forEach(sourceUrl => {
        if (sourceUrl && !seenUrls.has(sourceUrl)) {
          seenUrls.add(sourceUrl);
          // 处理相对路径
          let fullUrl = sourceUrl;
          if (!fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
            try {
              fullUrl = new URL(fullUrl, window.location.href).href;
            } catch (error) {
              console.warn('无法解析URL:', fullUrl, error);
              return;
            }
          }

          const type = getImageType(fullUrl);
          images.push({
            src: fullUrl,
            alt: img.alt || '',
            width: 0,
            height: 0,
            type: type,
            elementType: 'img-lazy'
          });
        }
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

  // 提取picture和source标签中的图片
  const pictureElements = document.querySelectorAll('picture');
  console.log('找到', pictureElements.length, '个picture元素');
  for (const picture of pictureElements) {
    const sourceElements = picture.querySelectorAll('source');
    for (const source of sourceElements) {
      const srcset = source.getAttribute('srcset');
      const src = source.getAttribute('src');

      if (srcset) {
        // 处理srcset属性
        const sources = srcset.split(',').map(item => {
          const parts = item.trim().split(' ');
          return parts[0];
        });

        sources.forEach(sourceUrl => {
          if (sourceUrl && !seenUrls.has(sourceUrl)) {
            seenUrls.add(sourceUrl);
            // 处理相对路径
            let fullUrl = sourceUrl;
            if (!fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
              try {
                fullUrl = new URL(fullUrl, window.location.href).href;
              } catch (error) {
                console.warn('无法解析URL:', fullUrl, error);
                return;
              }
            }

            const type = getImageType(fullUrl);
            images.push({
              src: fullUrl,
              alt: '',
              width: 0,
              height: 0,
              type: type,
              elementType: 'source'
            });
          }
        });
      }

      if (src && !seenUrls.has(src)) {
        seenUrls.add(src);
        // 处理相对路径
        let fullUrl = src;
        if (!fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
          try {
            fullUrl = new URL(fullUrl, window.location.href).href;
          } catch (error) {
            console.warn('无法解析URL:', fullUrl, error);
            return;
          }
        }

        const type = getImageType(fullUrl);
        images.push({
          src: fullUrl,
          alt: '',
          width: 0,
          height: 0,
          type: type,
          elementType: 'source'
        });
      }
    }
  }

  // 提取video标签中的图片（海报图等）
  const videoElements = document.querySelectorAll('video');
  console.log('找到', videoElements.length, '个video元素');
  for (const video of videoElements) {
    const poster = video.getAttribute('poster');
    if (poster && !seenUrls.has(poster)) {
      seenUrls.add(poster);
      // 处理相对路径
      let fullUrl = poster;
      if (!fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
        try {
          fullUrl = new URL(fullUrl, window.location.href).href;
        } catch (error) {
          console.warn('无法解析URL:', fullUrl, error);
          return;
        }
      }

      const type = getImageType(fullUrl);
      images.push({
        src: fullUrl,
        alt: '',
        width: 0,
        height: 0,
        type: type,
        elementType: 'video-poster'
      });
    }
  }

  // 提取object和embed标签中的图片
  const objectElements = document.querySelectorAll('object, embed');
  console.log('找到', objectElements.length, '个object/embed元素');
  for (const element of objectElements) {
    const data = element.getAttribute('data');
    const src = element.getAttribute('src');
    const type = element.getAttribute('type');

    const url = data || src;
    if (url && !seenUrls.has(url)) {
      // 检查是否可能包含图片
      const elementType = type || '';
      if (elementType.includes('image/') ||
        url.includes('.jpg') || url.includes('.jpeg') ||
        url.includes('.png') || url.includes('.gif') ||
        url.includes('.webp') || url.includes('.svg')) {

        seenUrls.add(url);
        // 处理相对路径
        let fullUrl = url;
        if (!fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
          try {
            fullUrl = new URL(fullUrl, window.location.href).href;
          } catch (error) {
            console.warn('无法解析URL:', fullUrl, error);
            return;
          }
        }

        const imageType = getImageType(fullUrl);
        images.push({
          src: fullUrl,
          alt: '',
          width: 0,
          height: 0,
          type: imageType,
          elementType: element.tagName.toLowerCase()
        });
      }
    }
  }

  // 提取preload链接中的图片
  const linkElements = document.querySelectorAll('link[rel="preload"][as="image"]');
  console.log('找到', linkElements.length, '个preload图片链接');
  for (const link of linkElements) {
    const href = link.getAttribute('href');
    if (href && !seenUrls.has(href)) {
      seenUrls.add(href);
      // 处理相对路径
      let fullUrl = href;
      if (!fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
        try {
          fullUrl = new URL(fullUrl, window.location.href).href;
        } catch (error) {
          console.warn('无法解析URL:', fullUrl, error);
          return;
        }
      }

      const type = getImageType(fullUrl);
      images.push({
        src: fullUrl,
        alt: '',
        width: 0,
        height: 0,
        type: type,
        elementType: 'preload'
      });
    }
  }

  // 提取svg内部的图片
  const svgElements = document.querySelectorAll('svg');
  console.log('找到', svgElements.length, '个svg元素');
  for (const svg of svgElements) {
    const imageElements = svg.querySelectorAll('image');
    for (const image of imageElements) {
      const href = image.getAttribute('href') || image.getAttribute('xlink:href');
      if (href && !seenUrls.has(href)) {
        seenUrls.add(href);
        // 处理相对路径
        let fullUrl = href;
        if (!fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
          try {
            fullUrl = new URL(fullUrl, window.location.href).href;
          } catch (error) {
            console.warn('无法解析URL:', fullUrl, error);
            return;
          }
        }

        const type = getImageType(fullUrl);
        images.push({
          src: fullUrl,
          alt: '',
          width: 0,
          height: 0,
          type: type,
          elementType: 'svg-image'
        });
      }
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

                  // 对于可能的图片，使用协调函数获取完整的类型和尺寸信息
                  if (type === 'unknown' || ['jpg', 'png', 'gif', 'webp', 'bmp', 'avif', 'tiff', 'ico', 'heic'].includes(type)) {
                    const currentImage = {
                      src: url,
                      alt: '',
                      width: width,
                      height: height,
                      type: type,
                      elementType: 'background'
                    };

                    // 异步获取完整信息但不阻塞主流程
                    getImageInfoCoordinated(url, currentImage).then(updatedImage => {
                      if (updatedImage.type !== currentImage.type || updatedImage.width !== currentImage.width || updatedImage.height !== currentImage.height) {
                        // 更新已提取图片的信息
                        const existingImage = images.find(img => img.src === url);
                        if (existingImage) {
                          Object.assign(existingImage, updatedImage);

                          // 更新localStorage中的图片信息
                          try {
                            const storedImages = localStorage.getItem('pageImages');
                            if (storedImages) {
                              const storedImagesArray = JSON.parse(storedImages);
                              const storedImage = storedImagesArray.find(img => img.src === url);
                              if (storedImage) {
                                Object.assign(storedImage, updatedImage);
                                localStorage.setItem('pageImages', JSON.stringify(storedImagesArray));
                              }
                            }
                          } catch (error) {
                            console.warn('更新localStorage中的图片信息失败:', error);
                          }
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

  // 对类型为unknown的图片进行同步类型检测和尺寸获取
  images.forEach((image, index) => {
    if (image.type === 'unknown') {
      // 尝试通过URL特征重新检测
      const detectedType = getImageType(image.src);
      if (detectedType !== 'unknown') {
        image.type = detectedType;
      }

      // 尝试通过图片元素特征检测
      if (image.type === 'unknown' && image.elementType === 'img') {
        // 查找对应的DOM元素
        const imgElements = document.querySelectorAll('img');
        const imgElement = Array.from(imgElements).find(img => img.src === image.src);
        if (imgElement) {
          // 尝试从元素属性中获取线索
          const className = imgElement.className || '';
          const alt = imgElement.alt || '';
          const title = imgElement.title || '';

          const combinedText = (className + ' ' + alt + ' ' + title).toLowerCase();
          if (combinedText.includes('png')) {
            image.type = 'png';
          } else if (combinedText.includes('jpg') || combinedText.includes('jpeg')) {
            image.type = 'jpg';
          } else if (combinedText.includes('gif')) {
            image.type = 'gif';
          } else if (combinedText.includes('webp')) {
            image.type = 'webp';
          } else if (combinedText.includes('svg')) {
            image.type = 'svg';
          } else if (combinedText.includes('bmp')) {
            image.type = 'bmp';
          } else if (combinedText.includes('avif')) {
            image.type = 'avif';
          }
        }
      }
    }

    // 尝试获取更多图片的尺寸信息
    if (image.width === 0 && image.height === 0) {
      // 对于img类型的图片，尝试从DOM元素获取尺寸
      if (image.elementType === 'img' || image.elementType === 'img-lazy') {
        const imgElements = document.querySelectorAll('img');
        const imgElement = Array.from(imgElements).find(img => {
          // 匹配src或data-src
          return img.src === image.src ||
            img.getAttribute('data-src') === image.src ||
            img.getAttribute('data-original') === image.src;
        });
        if (imgElement) {
          // 尝试获取原始尺寸
          if (imgElement.naturalWidth && imgElement.naturalHeight) {
            image.width = imgElement.naturalWidth;
            image.height = imgElement.naturalHeight;
          }
          // 尝试获取当前显示尺寸
          else if (imgElement.width && imgElement.height) {
            image.width = imgElement.width;
            image.height = imgElement.height;
          }
          // 尝试从style或属性中获取尺寸
          else {
            // 从style属性中获取
            const styleWidth = imgElement.style.width;
            const styleHeight = imgElement.style.height;
            if (styleWidth) {
              const widthMatch = styleWidth.match(/(\d+)px/);
              if (widthMatch) image.width = parseInt(widthMatch[1]);
            }
            if (styleHeight) {
              const heightMatch = styleHeight.match(/(\d+)px/);
              if (heightMatch) image.height = parseInt(heightMatch[1]);
            }
            // 从width/height属性中获取
            if (!image.width && imgElement.getAttribute('width')) {
              image.width = parseInt(imgElement.getAttribute('width')) || 0;
            }
            if (!image.height && imgElement.getAttribute('height')) {
              image.height = parseInt(imgElement.getAttribute('height')) || 0;
            }
            // 从data属性中获取尺寸
            if (!image.width && imgElement.getAttribute('data-width')) {
              image.width = parseInt(imgElement.getAttribute('data-width')) || 0;
            }
            if (!image.height && imgElement.getAttribute('data-height')) {
              image.height = parseInt(imgElement.getAttribute('data-height')) || 0;
            }
          }
        }
      }
      // 对于SVG类型的图片，尝试解析尺寸
      if (image.type === 'svg') {
        // 尝试解析SVG尺寸
        if (image.src.startsWith('data:image/svg+xml')) {
          try {
            const encodedSvg = image.src.split(',')[1];
            if (encodedSvg) {
              const svgContent = decodeURIComponent(encodedSvg);
              const dimensions = parseSvgDimensions(svgContent);
              if (dimensions.width > 0 && dimensions.height > 0) {
                image.width = dimensions.width;
                image.height = dimensions.height;
              }
            }
          } catch (error) {
            console.warn('解析SVG尺寸失败:', error);
          }
        } else {
          // 对于普通URL形式的SVG，尝试从DOM元素获取尺寸
          const imgElements = document.querySelectorAll('img');
          const imgElement = Array.from(imgElements).find(img => img.src === image.src);
          if (imgElement) {
            // 尝试获取原始尺寸
            if (imgElement.naturalWidth && imgElement.naturalHeight) {
              image.width = imgElement.naturalWidth;
              image.height = imgElement.naturalHeight;
            }
            // 尝试获取当前显示尺寸
            else if (imgElement.width && imgElement.height) {
              image.width = imgElement.width;
              image.height = imgElement.height;
            }
          }

          // 尝试从SVG元素本身获取尺寸
          if (image.elementType === 'svg-image') {
            const svgElements = document.querySelectorAll('svg');
            for (const svg of svgElements) {
              const imageElements = svg.querySelectorAll('image');
              for (const img of imageElements) {
                const href = img.getAttribute('href') || img.getAttribute('xlink:href');
                if (href === image.src) {
                  // 尝试从image元素获取尺寸
                  const imgWidth = img.getAttribute('width');
                  const imgHeight = img.getAttribute('height');
                  if (imgWidth && imgHeight) {
                    const widthNum = parseSvgLength(imgWidth);
                    const heightNum = parseSvgLength(imgHeight);
                    if (widthNum > 0 && heightNum > 0) {
                      image.width = widthNum;
                      image.height = heightNum;
                    }
                  }
                  break;
                }
              }
            }
          }

          // 尝试通过fetch获取SVG内容并解析尺寸
          if (image.width === 0 && image.height === 0) {
            try {
              // 使用fetch获取SVG内容
              fetch(image.src, {
                mode: 'cors',
                cache: 'no-cache'
              }).then(response => {
                if (response.ok) {
                  return response.text();
                }
                throw new Error('Network response was not ok');
              }).then(svgContent => {
                // 解析SVG尺寸
                const dimensions = parseSvgDimensions(svgContent);
                if (dimensions.width > 0 && dimensions.height > 0) {
                  // 更新图片尺寸
                  image.width = dimensions.width;
                  image.height = dimensions.height;

                  // 更新localStorage中的图片尺寸
                  try {
                    const storedImages = localStorage.getItem('pageImages');
                    if (storedImages) {
                      const storedImagesArray = JSON.parse(storedImages);
                      const storedImage = storedImagesArray.find(img => img.src === image.src);
                      if (storedImage) {
                        storedImage.width = dimensions.width;
                        storedImage.height = dimensions.height;
                        localStorage.setItem('pageImages', JSON.stringify(storedImagesArray));
                      }
                    }
                  } catch (error) {
                    console.warn('更新localStorage中的图片尺寸失败:', error);
                  }
                }
              }).catch(error => {
                console.warn('通过fetch获取SVG尺寸失败:', image.src, error);
              });
            } catch (error) {
              console.warn('处理SVG fetch请求失败:', error);
            }
          }
        }
      }
      // 对于canvas类型的图片，直接使用canvas尺寸
      else if (image.elementType === 'canvas') {
        const canvasElements = document.querySelectorAll('canvas');
        for (const canvas of canvasElements) {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            if (dataUrl === image.src) {
              image.width = canvas.width;
              image.height = canvas.height;
              break;
            }
          } catch (error) {
            console.warn('提取canvas尺寸失败:', error);
          }
        }
      }
    }
  });

  // 性能优化：图片尺寸过滤和智能去重
  const filteredImages = [];
  const uniqueUrls = new Set();
  const minWidth = 10; // 最小宽度阈值
  const minHeight = 10; // 最小高度阈值

  images.forEach(image => {
    // 过滤过小的图片
    if ((image.width >= minWidth || image.height >= minHeight) ||
      (image.width === 0 && image.height === 0)) { // 未知尺寸的图片保留

      // 智能URL标准化和去重
      let normalizedUrl = image.src;

      // 标准化URL：移除UTM参数和跟踪参数
      if (normalizedUrl.includes('?')) {
        const urlParts = normalizedUrl.split('?');
        const baseUrl = urlParts[0];
        const params = urlParts[1];
        const paramPairs = params.split('&').filter(param => {
          const key = param.split('=')[0].toLowerCase();
          // 移除常见的跟踪参数
          return !['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'gclid', 'fbclid', 'msclkid', 'mc_eid', 'cid', 'pid'].includes(key);
        });

        if (paramPairs.length > 0) {
          normalizedUrl = baseUrl + '?' + paramPairs.join('&');
        } else {
          normalizedUrl = baseUrl;
        }
      }

      // 去重
      if (!uniqueUrls.has(normalizedUrl)) {
        uniqueUrls.add(normalizedUrl);
        // 更新图片的标准化URL
        image.src = normalizedUrl;
        filteredImages.push(image);
      }
    }
  });

  console.log('提取到', filteredImages.length, '张图片（已过滤和去重）');
  return filteredImages;
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

  // 增强：检查URL参数中的图片格式线索
  const urlParams = url.split('?')[1];
  if (urlParams) {
    const paramsLower = urlParams.toLowerCase();
    if (paramsLower.includes('format=png') || paramsLower.includes('type=png')) {
      return 'png';
    }
    if (paramsLower.includes('format=jpg') || paramsLower.includes('type=jpg') ||
      paramsLower.includes('format=jpeg') || paramsLower.includes('type=jpeg')) {
      return 'jpg';
    }
    if (paramsLower.includes('format=webp') || paramsLower.includes('type=webp')) {
      return 'webp';
    }
    if (paramsLower.includes('format=gif') || paramsLower.includes('type=gif')) {
      return 'gif';
    }
    if (paramsLower.includes('format=avif') || paramsLower.includes('type=avif')) {
      return 'avif';
    }
    if (paramsLower.includes('format=heic') || paramsLower.includes('type=heic')) {
      return 'heic';
    }
    if (paramsLower.includes('format=heif') || paramsLower.includes('type=heif')) {
      return 'heic'; // 统一为heic
    }
  }

  // 增强：检查URL路径中的常见图片服务器路径
  if (urlLower.includes('/png/') || urlLower.includes('/images/png/') || urlLower.includes('/img/png/')) {
    return 'png';
  }
  if (urlLower.includes('/jpg/') || urlLower.includes('/images/jpg/') || urlLower.includes('/img/jpg/') ||
    urlLower.includes('/jpeg/') || urlLower.includes('/images/jpeg/') || urlLower.includes('/img/jpeg/')) {
    return 'jpg';
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
  if (urlLower.includes('image/bmp')) {
    return 'bmp';
  }
  if (urlLower.includes('image/avif')) {
    return 'avif';
  }
  if (urlLower.includes('image/tiff')) {
    return 'tiff';
  }
  if (urlLower.includes('image/ico')) {
    return 'ico';
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