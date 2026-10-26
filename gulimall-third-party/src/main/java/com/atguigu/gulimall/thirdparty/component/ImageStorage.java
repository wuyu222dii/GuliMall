package com.atguigu.gulimall.thirdparty.component;

import java.io.IOException;
import java.nio.file.Path;

public interface ImageStorage {
    String save(Path normalizedImage,String generatedName) throws IOException;
}
