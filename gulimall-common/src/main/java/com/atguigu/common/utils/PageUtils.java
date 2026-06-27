/**
 * Copyright (c) 2016-2019 Renren Open Source All rights reserved.
 *
 * https://www.renren.io
 *
 * All rights reserved.
 */

package com.atguigu.common.utils;

import com.baomidou.mybatisplus.core.metadata.IPage;

import java.io.Serializable;
import java.util.List;

/**
 * Pagination utility
 *
 * @author Mark sunlightcs@gmail.com
 */
public class PageUtils implements Serializable {
	private static final long serialVersionUID = 1L;
	/**
	 * Total record count
	 */
	private int totalCount;
	/**
	 * Records per page
	 */
	private int pageSize;
	/**
	 * Total page count
	 */
	private int totalPage;
	/**
	 * Current page number
	 */
	private int currPage;
	/**
	 * List data
	 */
	private List<?> list;
	
	/**
	 * Pagination
	 * @param list        List data
	 * @param totalCount  Total record count
	 * @param pageSize    Records per page
	 * @param currPage    Current page number
	 */
	public PageUtils(List<?> list, int totalCount, int pageSize, int currPage) {
		this.list = list;
		this.totalCount = totalCount;
		this.pageSize = pageSize;
		this.currPage = currPage;
		this.totalPage = (int)Math.ceil((double)totalCount/pageSize);
	}

	/**
	 * Pagination
	 */
	public PageUtils(IPage<?> page) {
		this.list = page.getRecords();
		this.totalCount = (int)page.getTotal();
		this.pageSize = (int)page.getSize();
		this.currPage = (int)page.getCurrent();
		this.totalPage = (int)page.getPages();
	}

	public int getTotalCount() {
		return totalCount;
	}

	public void setTotalCount(int totalCount) {
		this.totalCount = totalCount;
	}

	public int getPageSize() {
		return pageSize;
	}

	public void setPageSize(int pageSize) {
		this.pageSize = pageSize;
	}

	public int getTotalPage() {
		return totalPage;
	}

	public void setTotalPage(int totalPage) {
		this.totalPage = totalPage;
	}

	public int getCurrPage() {
		return currPage;
	}

	public void setCurrPage(int currPage) {
		this.currPage = currPage;
	}

	public List<?> getList() {
		return list;
	}

	public void setList(List<?> list) {
		this.list = list;
	}
	
}
