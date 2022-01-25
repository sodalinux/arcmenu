/*
 * ArcMenu - A traditional application menu for GNOME 3
 *
 * ArcMenu Lead Developer and Maintainer
 * Andrew Zaech https://gitlab.com/AndrewZaech
 *
 * ArcMenu Founder, Former Maintainer, and Former Graphic Designer
 * LinxGem33 https://gitlab.com/LinxGem33 - (No Longer Active)
 *
 * tognee Layout Created By: tognee https://gitlab.com/tognee
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GLib, Gio, Gtk, Shell, St} = imports.gi;
const BaseMenuLayout = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const PopupMenu = imports.ui.popupMenu;
const Utils = Me.imports.utils;
const _ = Gettext.gettext;

var createMenu = class extends BaseMenuLayout.BaseLayout{
    constructor(menuButton) {
        super(menuButton, {
            Search: true,
            DisplayType: Constants.DisplayType.LIST,
            SearchDisplayType: Constants.DisplayType.LIST,
            GridColumns: 1,
            ColumnSpacing: 0,
            RowSpacing: 0,
            VerticalMainBox: true,
            DefaultCategoryIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultApplicationIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultQuickLinksIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultButtonsIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultPinnedIconSize: Constants.MEDIUM_ICON_SIZE,
        });
    }

    createLayout(){
        super.createLayout();

        this.searchBox.name = "ArcSearchEntryRound";

        //subMainBox stores left and right box
        this.subMainBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            style_class: 'margin-box'
        });
        this.mainBox.add(this.subMainBox);

        // The "Left Box"
        // Contains the app list and the searchbar
        this.appBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            vertical: true,
            y_align: Clutter.ActorAlign.FILL,
            style_class: 'left-panel'
        });

        //Applications Box - Contains Favorites, Categories or programs
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: 'left-panel ' + (this.disableFadeEffect ? '' : 'small-vfade'),
            overlay_scrollbars: true,
            reactive:true
        });
        let horizonalFlip = this._settings.get_boolean("enable-horizontal-flip");

        if(this._settings.get_enum('searchbar-default-bottom-location') === Constants.SearchbarLocation.TOP){
            this.searchBox.style = "margin: 0px 10px 10px 10px;";
            this.appBox.add(this.searchBox.actor);
        }
        this.appBox.add(this.applicationsScrollBox);
        this.applicationsBox = new St.BoxLayout({ vertical: true });
        this.applicationsScrollBox.add_actor(this.applicationsBox);

        this.navigateBox = new St.BoxLayout({ 
            vertical: true,
            x_expand: true, 
            y_expand: true,
            y_align: Clutter.ActorAlign.END
        });
        this.backButton = new MW.BackMenuItem(this);
        this.navigateBox.add(new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.HORIZONTAL));
        this.navigateBox.add(this.backButton.actor);
        this.appBox.add(this.navigateBox);
        if(this._settings.get_enum('searchbar-default-bottom-location') === Constants.SearchbarLocation.BOTTOM){
            this.searchBox.style = "margin: 10px 10px 0px 10px;";
            this.appBox.add(this.searchBox.actor);
        }
        
        // The "Right Box"
        // Contains some useful shortcuts
        this.quickBox = new St.BoxLayout({
            vertical: true,
            style: "margin: 0px 1px;",
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL
        });

        this.subMainBox.add(horizonalFlip ? this.appBox : this.quickBox);  
        let verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.VERTICAL);
        this.subMainBox.add(verticalSeparator);
        this.subMainBox.add(horizonalFlip ? this.quickBox : this.appBox);

        this.placesShortcuts= this._settings.get_value('directory-shortcuts-list').deep_unpack().length>0;
        this.softwareShortcuts = this._settings.get_value('application-shortcuts-list').deep_unpack().length>0;

        this.shortcutsBox = new St.BoxLayout({
            vertical: true,
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            style: "spacing: 5px; padding-bottom: 5px;"
        });

        this.shortcutsScrollBox = this._createScrollBox({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            overlay_scrollbars: true,
            style_class: this.disableFadeEffect ? '' : 'small-vfade',
        });    
        this.shortcutsScrollBox.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL);
        this.shortcutsScrollBox.add_actor(this.shortcutsBox);
        this.quickBox.add(this.shortcutsScrollBox);

        // Add place shortcuts to menu (Home,Documents,Downloads,Music,Pictures,Videos)
        this._displayPlaces();

        //check to see if should draw separator
        if(this.placesShortcuts && this.softwareShortcuts){
            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.LONG, Constants.SeparatorAlignment.HORIZONTAL);
            this.shortcutsBox.add(separator);
        }

        //Add Application Shortcuts to menu (Software, Settings, Tweaks, Terminal)
        let SOFTWARE_TRANSLATIONS = [_("Software"), _("Settings"), _("Tweaks"), _("Terminal"), _("Activities Overview"), _("ArcMenu Settings")];
        let applicationShortcuts = this._settings.get_value('application-shortcuts-list').deep_unpack();
        for(let i = 0; i < applicationShortcuts.length; i++){
            let applicationName = applicationShortcuts[i][0];
            let isContainedInCategory = false;
            let shortcutMenuItem = new MW.ShortcutMenuItem(this, _(applicationName), applicationShortcuts[i][1], applicationShortcuts[i][2], Constants.DisplayType.BUTTON, isContainedInCategory);
            if(shortcutMenuItem.shouldShow)
                this.shortcutsBox.add(shortcutMenuItem.actor);
        }
        
        // Bottom Section for Power etc...
        this.actionsScrollBox = new St.ScrollView({
            x_expand: true,
            y_expand: false,
            y_align: Clutter.ActorAlign.END,
            x_align: Clutter.ActorAlign.CENTER
        });
        this.actionsScrollBox.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL);
        this.actionsScrollBox.clip_to_allocation = true;

        //create new section for Leave Button
        this.actionsBox = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            style: "spacing: 3px;"
        });
        this.actionsScrollBox.add_actor(this.actionsBox);
        
        let leaveButton = new MW.LeaveButton(this);
        this.actionsBox.add(leaveButton.actor); 
        let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.LONG, Constants.SeparatorAlignment.HORIZONTAL);
        this.actionsBox.insert_child_at_index(separator, 0);
        this.quickBox.add(this.actionsScrollBox);

        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    _displayPlaces() {
        let directoryShortcuts = this._settings.get_value('directory-shortcuts-list').deep_unpack();
        for (let i = 0; i < directoryShortcuts.length; i++) {
            let directory = directoryShortcuts[i];
            let isContainedInCategory = false;
            let placeMenuItem = this.createMenuItem(directory, Constants.DisplayType.BUTTON, isContainedInCategory);
            this.shortcutsBox.add_actor(placeMenuItem.actor);
        }
    }

    loadCategories(){
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();

        let extraCategories = this._settings.get_value("extra-categories").deep_unpack();

        for(let i = 0; i < extraCategories.length; i++){
            let categoryEnum = extraCategories[i][0];
            let shouldShow = extraCategories[i][1];
            if(shouldShow){
                let categoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.LIST);
                this.categoryDirectories.set(categoryEnum, categoryMenuItem);
            }
        }

        super.loadCategories();
    }

    displayPinnedApps(){
        super.displayPinnedApps();
        this.activeCategoryType = Constants.CategoryType.PINNED_APPS;
        this.navigateBox.show();
    }

    displayAllApps(){
        this.navigateBox.hide();
        super.displayAllApps()
    }

    displayCategories(){
        super.displayCategories();
        this.activeCategoryType = Constants.CategoryType.CATEGORIES_LIST;
        this.navigateBox.hide();
    }

    setDefaultMenuView(){
        super.setDefaultMenuView();
        let defaultMenuView = this._settings.get_enum('default-menu-view-tognee');

        if(defaultMenuView === Constants.DefaultMenuViewTognee.CATEGORIES_LIST)
            this.displayCategories();
        else if(defaultMenuView === Constants.DefaultMenuViewTognee.ALL_PROGRAMS)
            this.displayAllApps();
    }

    displayCategoryAppList(appList, category){
        super.displayCategoryAppList(appList, category);
        this.activeCategoryType = Constants.CategoryType.CATEGORY_APP_LIST;
        this.navigateBox.show();
    }

    displayRecentFiles(){
        super.displayRecentFiles();
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES; 
        this.navigateBox.show();
    }

    _onSearchBoxChanged(searchBox, searchString){  
        super._onSearchBoxChanged(searchBox, searchString);  
        if(searchBox.isEmpty()){  
            this.navigateBox.hide();  
        }            
        else if(!searchBox.isEmpty()){  
            this.navigateBox.show();
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;   
        }            
    }
}
