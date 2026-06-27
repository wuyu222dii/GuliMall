package io.renren.utils;

import java.io.Serializable;
import java.util.List;

/**
 * Pagination utility
 * 
 * @author chenshun
 * @email sunlightcs@gmail.com
 * @date Nov 4, 2016
 */
public class PageUtils implements Serializable {
	private static final long serialVersionUID = 1L;
	// Total records
	private int totalCount;
	// Records per page
	private int pageSize;
	// Total pages
	private int totalPage;
	// Current page
	private int currPage;
	// List data
	private List<?> list;
	
	/**
	 * Paginate
	 * @param list        list data
	 * @param totalCount  total record count
	 * @param pageSize    records per page
	 * @param currPage    current page
	 */
	public PageUtils(List<?> list, int totalCount, int pageSize, int currPage) {
		this.list = list;
		this.totalCount = totalCount;
		this.pageSize = pageSize;
		this.currPage = currPage;
		this.totalPage = (int)Math.ceil((double)totalCount/pageSize);
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
