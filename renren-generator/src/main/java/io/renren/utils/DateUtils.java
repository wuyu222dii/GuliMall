package io.renren.utils;

import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Date utilities
 * 
 * @author chenshun
 * @email sunlightcs@gmail.com
 * @date Dec 21, 2016
 */
public class DateUtils {
	/** Date format (yyyy-MM-dd) */
	public final static String DATE_PATTERN = "yyyy-MM-dd";
	/** Date-time format (yyyy-MM-dd HH:mm:ss) */
	public final static String DATE_TIME_PATTERN = "yyyy-MM-dd HH:mm:ss";
	
	public static String format(Date date) {
        return format(date, DATE_PATTERN);
    }

    public static String format(Date date, String pattern) {
        if(date != null){
            SimpleDateFormat df = new SimpleDateFormat(pattern);
            return df.format(date);
        }
        return null;
    }
}
