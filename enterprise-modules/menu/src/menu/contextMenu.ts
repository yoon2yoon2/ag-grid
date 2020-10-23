import {
    Autowired,
    Bean,
    BeanStub,
    CellPosition,
    Column,
    ColumnController,
    Component,
    FocusController,
    GetContextMenuItems,
    GetContextMenuItemsParams,
    GridOptionsWrapper,
    IAfterGuiAttachedParams,
    IContextMenuFactory,
    MenuItemDef,
    ModuleNames,
    ModuleRegistry,
    PopupService,
    PostConstruct,
    RowNode,
    Optional,
    IRangeController,
    CellPositionUtils,
    _,
    GridPanel
} from "@ag-grid-community/core";
import { MenuItemComponent } from "./menuItemComponent";
import { MenuList } from "./menuList";
import { MenuItemMapper } from "./menuItemMapper";

@Bean('contextMenuFactory')
export class ContextMenuFactory extends BeanStub implements IContextMenuFactory {

    @Autowired('popupService') private popupService: PopupService;
    @Autowired('gridOptionsWrapper') private gridOptionsWrapper: GridOptionsWrapper;
    @Optional('rangeController') private rangeController: IRangeController;
    @Autowired('columnController') private columnController: ColumnController;

    private activeMenu: ContextMenu | null;
    private gridPanel: GridPanel;

    public registerGridComp(gridPanel: GridPanel): void {
        this.gridPanel = gridPanel;
    }

    public hideActiveMenu(): void {
        this.destroyBean(this.activeMenu);
    }

    private getMenuItems(node: RowNode, column: Column, value: any): (MenuItemDef | string)[] | undefined {
        const defaultMenuOptions: string[] = [];

        if (_.exists(node) && ModuleRegistry.isRegistered(ModuleNames.ClipboardModule)) {
            if (column) {
                // only makes sense if column exists, could have originated from a row
                defaultMenuOptions.push('copy', 'copyWithHeaders', 'paste', 'separator');
            }
        }

        if (this.gridOptionsWrapper.isEnableCharts() &&
            ModuleRegistry.isRegistered(ModuleNames.RangeSelectionModule) &&
            ModuleRegistry.isRegistered(ModuleNames.GridChartsModule)) {
            if (this.columnController.isPivotMode()) {
                defaultMenuOptions.push('pivotChart');
            }

            if (this.rangeController && !this.rangeController.isEmpty()) {
                defaultMenuOptions.push('chartRange');
            }
        }

        if (_.exists(node)) {
            // if user clicks a cell
            const csvModuleMissing = !ModuleRegistry.isRegistered(ModuleNames.CsvExportModule);
            const excelModuleMissing = !ModuleRegistry.isRegistered(ModuleNames.ExcelExportModule);
            const suppressExcel = this.gridOptionsWrapper.isSuppressExcelExport() || excelModuleMissing;
            const suppressCsv = this.gridOptionsWrapper.isSuppressCsvExport() || csvModuleMissing;
            const onIPad = _.isIOSUserAgent();
            const anyExport: boolean = !onIPad && (!suppressExcel || !suppressCsv);
            if (anyExport) {
                defaultMenuOptions.push('export');
            }
        }

        if (this.gridOptionsWrapper.getContextMenuItemsFunc()) {
            const userFunc: GetContextMenuItems | undefined = this.gridOptionsWrapper.getContextMenuItemsFunc();
            const params: GetContextMenuItemsParams = {
                node: node,
                column: column,
                value: value,
                defaultItems: defaultMenuOptions.length ? defaultMenuOptions : undefined,
                api: this.gridOptionsWrapper.getApi(),
                columnApi: this.gridOptionsWrapper.getColumnApi(),
                context: this.gridOptionsWrapper.getContext()
            };

            return userFunc ? userFunc(params) : undefined;
        }

        return defaultMenuOptions;
    }

    public showMenu(node: RowNode, column: Column, value: any, mouseEvent: MouseEvent | Touch): boolean {
        const menuItems = this.getMenuItems(node, column, value);

        if (menuItems === undefined || _.missingOrEmpty(menuItems)) { return false; }

        const menu = new ContextMenu(menuItems);
        this.createBean(menu);

        const eMenuGui = menu.getGui();

        const positionParams = {
            column: column,
            rowNode: node,
            type: 'contextMenu',
            mouseEvent: mouseEvent,
            ePopup: eMenuGui,
            // move one pixel away so that accidentally double clicking
            // won't show the browser's contextmenu
            nudgeX: 1,
            nudgeY: 1
        };
        const positionCallback = this.popupService.positionPopupUnderMouseEvent.bind(this.popupService, positionParams);

        const hidePopup = this.popupService.addPopup({
            modal: true,
            eChild: eMenuGui,
            closeOnEsc: true,
            closedCallback: () => {
                this.destroyBean(menu);
            },
            click: mouseEvent,
            positionCallback: positionCallback,
            // so when browser is scrolled down, the context menu stays on the grid
            anchorToElement: this.gridPanel.getGui()
        });

        menu.afterGuiAttached({ container: 'contextMenu', hidePopup });

        // there should never be an active menu at this point, however it was found
        // that you could right click a second time just 1 or 2 pixels from the first
        // click, and another menu would pop up. so somehow the logic for closing the
        // first menu (clicking outside should close it) was glitchy somehow. an easy
        // way to avoid this is just remove the old context menu here if it exists.
        if (this.activeMenu) {
            this.hideActiveMenu();
        }

        this.activeMenu = menu;

        menu.addEventListener(BeanStub.EVENT_DESTROYED, () => {
            if (this.activeMenu === menu) {
                this.activeMenu = null;
            }
        });

        return true;
    }
}

class ContextMenu extends Component {

    @Autowired('menuItemMapper') private menuItemMapper: MenuItemMapper;
    @Autowired('focusController') private focusController: FocusController;
    @Autowired('cellPositionUtils') private cellPositionUtils: CellPositionUtils;

    private menuItems: (MenuItemDef | string)[];
    private menuList: MenuList | null = null;
    private focusedCell: CellPosition | null = null;

    constructor(menuItems: (MenuItemDef | string)[]) {
        super('<div class="ag-menu" role="presentation"></div>');
        this.menuItems = menuItems;
    }

    @PostConstruct
    private addMenuItems(): void {
        const menuList = this.createBean(new MenuList());
        const menuItemsMapped = this.menuItemMapper.mapWithStockItems(this.menuItems, null);

        menuList.addMenuItems(menuItemsMapped);

        this.appendChild(menuList);
        this.menuList = menuList;

        menuList.addEventListener(MenuItemComponent.EVENT_MENU_ITEM_SELECTED, this.destroy.bind(this));
    }

    public afterGuiAttached(params: IAfterGuiAttachedParams): void {
        if (params.hidePopup) {
            this.addDestroyFunc(params.hidePopup);
        }

        this.focusedCell = this.focusController.getFocusedCell();

        if (this.menuList) {
            this.focusController.focusInto(this.menuList.getGui());
        }

        // if the body scrolls, we want to hide the menu, as the menu will not appear in the right location anymore
        this.addManagedListener(this.eventService, 'bodyScroll', this.destroy.bind(this));
    }

    protected destroy(): void {
        const currentFocusedCell = this.focusController.getFocusedCell();

        if (currentFocusedCell && this.focusedCell && this.cellPositionUtils.equals(currentFocusedCell, this.focusedCell)) {
            const { rowIndex, rowPinned, column } = this.focusedCell;
            this.focusController.setFocusedCell(rowIndex, column, rowPinned, true);
        }

        super.destroy();
    }
}
