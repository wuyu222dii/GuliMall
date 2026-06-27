/**
 * Copyright (c) 2016-2019 Renren Open Source All rights reserved.
 *
 * https://www.renren.io
 *
 * All rights reserved.
 */

package com.atguigu.common.utils;

/**
 * Constants
 *
 * @author Mark sunlightcs@gmail.com
 */
public class Constant {
	/** Super admin id */
	public static final int SUPER_ADMIN = 1;
    /**
     * Current page number
     */
    public static final String PAGE = "page";
    /**
     * Records per page
     */
    public static final String LIMIT = "limit";
    /**
     * Sort field
     */
    public static final String ORDER_FIELD = "sidx";
    /**
     * Sort order
     */
    public static final String ORDER = "order";
    /**
     * Ascending order
     */
    public static final String ASC = "asc";
	/**
	 * Menu type
	 * 
	 * @author chenshun
	 * @email sunlightcs@gmail.com
	 * @date Nov 15, 2016 1:24:29 PM
	 */
    public enum MenuType {
        /**
         * Catalog
         */
    	CATALOG(0),
        /**
         * Menu
         */
        MENU(1),
        /**
         * Button
         */
        BUTTON(2);

        private int value;

        MenuType(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }
    
    /**
     * Scheduled task status
     * 
     * @author chenshun
     * @email sunlightcs@gmail.com
     * @date Dec 3, 2016 12:07:22 AM
     */
    public enum ScheduleStatus {
        /**
         * Normal
         */
    	NORMAL(0),
        /**
         * Paused
         */
    	PAUSE(1);

        private int value;

        ScheduleStatus(int value) {
            this.value = value;
        }
        
        public int getValue() {
            return value;
        }
    }

    /**
     * Cloud service provider
     */
    public enum CloudService {
        /**
         * Qiniu Cloud
         */
        QINIU(1),
        /**
         * Alibaba Cloud
         */
        ALIYUN(2),
        /**
         * Tencent Cloud
         */
        QCLOUD(3);

        private int value;

        CloudService(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }

}
