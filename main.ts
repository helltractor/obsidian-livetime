import { App, Plugin, PluginSettingTab, Setting, ItemView } from 'obsidian';

interface LifeClockSettings {
	birthday: string;
	deathAge: number;
	targetActivities: {
		name: string;
		frequency: number;
	}[];
}

const DEFAULT_SETTINGS: LifeClockSettings = {
	birthday: "2002-10-15",
	deathAge: 80,
	targetActivities: [
		{ name: "阅读", frequency: 52 },
		{ name: "旅行", frequency: 2 },
		{ name: "写作", frequency: 12 }
	]
}

const VIEW_TYPE_LIFE_CLOCK = "life-clock-view";

class LifeClockView extends ItemView {
	plugin: LifeClockPlugin;
	clockInterval: number | null = null;

	constructor(leaf: any, plugin: LifeClockPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_LIFE_CLOCK;
	}

	getDisplayText(): string {
		return "芳华流逝";
	}

	async onOpen(): Promise<void> {
		this.updateContent();
		this.clockInterval = window.setInterval(() => {
			this.updateContent();
		}, 1000);
	}

	async onClose(): Promise<void> {
		if (this.clockInterval) {
			clearInterval(this.clockInterval);
		}
	}

	updateContent(): void {
		const birthday = new Date(this.plugin.settings.birthday);
		const today = new Date();
		const deathDate = new Date(birthday);
		deathDate.setFullYear(birthday.getFullYear() + this.plugin.settings.deathAge);

		const timeDiff = today.getTime() - birthday.getTime();
		const remainingTime = deathDate.getTime() - today.getTime();

		const age = (timeDiff / (1000 * 60 * 60 * 24 * 365.25)).toFixed(10);
		const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
		const hourDiff = Math.floor(timeDiff / (1000 * 60 * 60));
		const minuteDiff = Math.floor(timeDiff / (1000 * 60));
		const secondDiff = Math.floor(timeDiff / 1000);

		const remainingYears = Math.round(remainingTime / (1000 * 60 * 60 * 24 * 365.25) * 1e10) / 1e10;
		const remainingDays = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
		const remainingHours = Math.floor(remainingTime / (1000 * 60 * 60));
		const remainingMinutes = Math.floor(remainingTime / (1000 * 60));
		const remainingSeconds = Math.floor(remainingTime / 1000);

		const activities = this.plugin.settings.targetActivities.map(activity => {
			const remainingTimes = Math.floor(activity.frequency * remainingYears);
			return {
				name: activity.name,
				remaining: remainingTimes
			};
		});

		let content = '';
		if (this.plugin.displayMode === 'clock') {
			content = `
				<div class="life-clock">
					<div class="life-clock-title">${this.plugin.isLifeClock ? '生之钟' : '死之钟'}</div>
					<div class="life-clock-content">
						${this.plugin.isLifeClock ? `
							<div class="life-clock-age">${age}岁</div>
							<div class="life-clock-day">${dayDiff}日</div>
							<div class="life-clock-hour">${hourDiff}小时</div>
							<div class="life-clock-minute">${minuteDiff}分钟</div>
							<div class="life-clock-second">${secondDiff}秒</div>
						` : `
							<div class="life-clock-age">${remainingYears}年</div>
							<div class="life-clock-day">${remainingDays}日</div>
							<div class="life-clock-hour">${remainingHours}小时</div>
							<div class="life-clock-minute">${remainingMinutes}分钟</div>
							<div class="life-clock-second">${remainingSeconds}秒</div>
							<div class="life-clock-activities">
								<h3>还能做多少次：</h3>
								${activities.map(activity => `
									<div class="activity-item">
										<span>${activity.name}</span>
										<span>${activity.remaining}次</span>
									</div>
								`).join('')}
							</div>
						`}
					</div>
				</div>
			`;
		} else {
			content = this.plugin.generateCalendarContent(birthday, deathDate, today);
		}

		this.containerEl.innerHTML = content;
	}
}

export default class LifeClockPlugin extends Plugin {
	settings: LifeClockSettings;
	isLifeClock: boolean = true;
	displayMode: 'clock' | 'calendar' = 'clock';
	view: LifeClockView | null = null;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_LIFE_CLOCK,
			(leaf) => (this.view = new LifeClockView(leaf, this))
		);

		this.addRibbonIcon("clock", "芳华流逝", () => {
			this.toggleClock();
			this.activateView();
		});

		this.addCommand({
			id: "toggle-display-mode",
			name: "切换显示模式",
			callback: () => {
				this.displayMode = this.displayMode === 'clock' ? 'calendar' : 'clock';
				if (this.view) {
					this.view.updateContent();
				}
			}
		});

		this.addSettingTab(new LifeClockSettingTab(this.app, this));
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_LIFE_CLOCK)[0];

		if (!leaf) {
			const newLeaf = workspace.getRightLeaf(false);
			if (newLeaf) {
				await newLeaf.setViewState({
					type: VIEW_TYPE_LIFE_CLOCK,
					active: true,
				});
				leaf = newLeaf;
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	toggleClock() {
		this.isLifeClock = !this.isLifeClock;
		if (this.view) {
			this.view.updateContent();
		}
	}

	generateCalendarContent(birthday: Date, deathDate: Date, today: Date): string {
		const totalDays = Math.ceil((deathDate.getTime() - birthday.getTime()) / (1000 * 60 * 60 * 24));
		const passedDays = Math.ceil((today.getTime() - birthday.getTime()) / (1000 * 60 * 60 * 24));
		const remainingDays = totalDays - passedDays;
		
		const weeks = Math.ceil(totalDays / 7);
		const passedWeeks = Math.ceil(passedDays / 7);
		const remainingWeeks = weeks - passedWeeks;

		let calendarHtml = '<div class="life-calendar">';
		
		// 添加年份标记
		calendarHtml += '<div class="calendar-years">';
		for (let i = 0; i < this.settings.deathAge; i++) {
			const yearStart = new Date(birthday);
			yearStart.setFullYear(birthday.getFullYear() + i);
			const yearEnd = new Date(birthday);
			yearEnd.setFullYear(birthday.getFullYear() + i + 1);
			
			const yearPassed = today > yearStart;
			const yearClass = yearPassed ? 'passed' : 'remaining';
			
			calendarHtml += `<div class="year-marker ${yearClass}">${i + 1}</div>`;
		}
		calendarHtml += '</div>';

		// 添加周历格子
		calendarHtml += '<div class="calendar-grid">';
		for (let i = 0; i < weeks; i++) {
			const weekPassed = i < passedWeeks;
			const weekClass = weekPassed ? 'passed' : 'remaining';
			calendarHtml += `<div class="week-cell ${weekClass}"></div>`;
		}
		calendarHtml += '</div>';

		// 添加统计信息
		calendarHtml += `
			<div class="calendar-stats">
				<div class="stat-item">
					<span class="stat-label">已过周数</span>
					<span class="stat-value">${passedWeeks}</span>
				</div>
				<div class="stat-item">
					<span class="stat-label">剩余周数</span>
					<span class="stat-value">${remainingWeeks}</span>
				</div>
				<div class="stat-item">
					<span class="stat-label">总周数</span>
					<span class="stat-value">${weeks}</span>
				</div>
			</div>
		`;

		calendarHtml += '</div>';
		return calendarHtml;
	}

	async onunload() {
		if (this.view) {
			await this.app.workspace.detachLeavesOfType(VIEW_TYPE_LIFE_CLOCK);
		}
	}
}

class LifeClockSettingTab extends PluginSettingTab {
	plugin: LifeClockPlugin;

	constructor(app: App, plugin: LifeClockPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl("h2", {text: "芳华流逝设置"});

		new Setting(containerEl)
			.setName('生日')
			.setDesc('设置出生日期')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(this.plugin.settings.birthday)
				.onChange(async (value) => {
					this.plugin.settings.birthday = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('预期寿命')
			.setDesc('设置预期寿命（年）')
			.addText(text => text
				.setPlaceholder('80')
				.setValue(this.plugin.settings.deathAge.toString())
				.onChange(async (value) => {
					this.plugin.settings.deathAge = parseInt(value) || 80;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("显示模式")
			.setDesc("切换当前显示为『时钟』或『日历』")
			.addButton(button => {
				button
					.setButtonText(this.plugin.displayMode === "clock" ? "切换到日历" : "切换到时钟")
					.setCta()
					.onClick(() => {
						this.plugin.displayMode = this.plugin.displayMode === "clock" ? "calendar" : "clock";
						button.setButtonText(this.plugin.displayMode === "clock" ? "切换到日历" : "切换到时钟");
						this.plugin.view?.updateContent();
					});
				});
	}
}
