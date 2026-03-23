// DialogueScene: Animal Crossing-style NPC dialogue overlay
// Launched on top of the current scene, shows text with typewriter effect

export class DialogueScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DialogueScene' });
    }

    init(data) {
        this.villagerName  = data.villagerName || 'Villager';
        this.villagerColor = data.villagerColor || '#88cc66';
        this.dialogues     = data.dialogues || ['Hello!'];
        this.onComplete    = data.onComplete || null;
        this.callerKey     = data.callerKey || null;
        this._pageIndex    = 0;
        this._typing       = false;
        this._fullText     = '';
        this._charIndex    = 0;
    }

    create() {
        const { width, height } = this.cameras.main;

        // Semi-transparent overlay
        this.overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.35)
            .setDepth(0);

        // Dialogue box
        const boxW = 750, boxH = 130;
        const boxX = width / 2;
        const boxY = height - 20 - boxH / 2;

        // Box background
        this.box = this.add.rectangle(boxX, boxY, boxW, boxH, 0x3a2a1a, 0.95)
            .setStrokeStyle(3, 0x6a5a3a)
            .setDepth(1);

        // Name label
        this.nameText = this.add.text(boxX - boxW / 2 + 20, boxY - boxH / 2 + 12, this.villagerName, {
            font: 'bold 16px monospace',
            fill: this.villagerColor,
            stroke: '#000000',
            strokeThickness: 2
        }).setDepth(2);

        // Dialogue text
        this.dialogueText = this.add.text(boxX - boxW / 2 + 20, boxY - boxH / 2 + 38, '', {
            font: '14px monospace',
            fill: '#eeddcc',
            wordWrap: { width: boxW - 40 },
            lineSpacing: 4
        }).setDepth(2);

        // Continue hint
        this.hintText = this.add.text(boxX + boxW / 2 - 20, boxY + boxH / 2 - 16, '', {
            font: '11px monospace',
            fill: '#887766'
        }).setOrigin(1, 0.5).setDepth(2);

        // Input
        this.input.keyboard.on('keydown-SPACE', () => this._advance());
        this.input.keyboard.on('keydown-ENTER', () => this._advance());
        this.input.on('pointerdown', () => this._advance());

        // Show first page
        this._showPage(0);
    }

    _showPage(index) {
        if (index >= this.dialogues.length) {
            this._close();
            return;
        }

        this._pageIndex = index;
        this._fullText = this.dialogues[index];
        this._charIndex = 0;
        this._typing = true;
        this.dialogueText.setText('');
        this.hintText.setText('');

        // Typewriter timer
        if (this._typeTimer) this._typeTimer.remove();
        this._typeTimer = this.time.addEvent({
            delay: 30,
            callback: () => {
                if (!this._typing) return;
                this._charIndex++;
                this.dialogueText.setText(this._fullText.substring(0, this._charIndex));
                if (this._charIndex >= this._fullText.length) {
                    this._typing = false;
                    this._showHint();
                }
            },
            repeat: this._fullText.length - 1
        });
    }

    _showHint() {
        const isLast = this._pageIndex >= this.dialogues.length - 1;
        this.hintText.setText(isLast ? '[SPACE] Close' : '[SPACE] Next ▶');

        // Gentle pulse
        this.tweens.add({
            targets: this.hintText,
            alpha: { from: 1, to: 0.4 },
            duration: 800, yoyo: true, repeat: -1
        });
    }

    _advance() {
        if (this._typing) {
            // Show full text immediately
            this._typing = false;
            if (this._typeTimer) this._typeTimer.remove();
            this.dialogueText.setText(this._fullText);
            this._showHint();
            return;
        }

        // Next page
        this._showPage(this._pageIndex + 1);
    }

    _close() {
        if (this._typeTimer) this._typeTimer.remove();

        if (this.onComplete) {
            this.onComplete();
        }

        this.scene.stop('DialogueScene');
        if (this.callerKey) {
            this.scene.resume(this.callerKey);
        }
    }
}
