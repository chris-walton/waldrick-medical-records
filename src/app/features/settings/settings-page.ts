import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { ExtraField, RecordType } from '../../core/models';

@Component({
  selector: 'app-settings-page',
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Settings</h1>
          <p class="page-subtitle">
            Record types. Immunizations are just one type — add your own to track anything
            (dental, vision, therapy, insurance…).
          </p>
        </div>
      </div>

      <div class="settings-grid">
        <mat-card>
          <mat-card-header><mat-card-title>Record types</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (loading()) {
              <mat-progress-bar mode="indeterminate" />
            } @else {
              <div class="type-list">
                @for (t of types(); track t.id) {
                  <div class="type-row">
                    <mat-icon>{{ t.icon || 'label' }}</mat-icon>
                    <div class="type-info">
                      <div class="type-label">{{ t.label }}</div>
                      <div class="muted type-meta">
                        <code>{{ t.key }}</code>
                        · {{ fieldCount(t) }} extra field(s)
                        @if (t.is_system) { · built-in }
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header><mat-card-title>Add a record type</mat-card-title></mat-card-header>
          <mat-card-content>
            <form class="dialog-form add-form">
              <mat-form-field appearance="outline">
                <mat-label>Label</mat-label>
                <input matInput [(ngModel)]="label" name="label" placeholder="e.g. Dental visit" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Material icon name</mat-label>
                <input matInput [(ngModel)]="icon" name="icon" placeholder="e.g. dentistry" />
                <mat-hint>Any name from Google Material Icons.</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Extra fields (comma separated)</mat-label>
                <input matInput [(ngModel)]="extraFields" name="extra" placeholder="e.g. Tooth, Procedure" />
                <mat-hint>Optional. Each becomes a text input on records of this type.</mat-hint>
              </mat-form-field>
              <div class="form-actions">
                <button mat-flat-button color="primary" [disabled]="!label.trim() || saving()" (click)="add()">
                  {{ saving() ? 'Adding…' : 'Add type' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .settings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
        align-items: start;
      }
      .type-list {
        display: flex;
        flex-direction: column;
      }
      .type-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }
      .type-row:last-child {
        border-bottom: none;
      }
      .type-label {
        font-weight: 500;
      }
      .type-meta code {
        background: #eef1f4;
        padding: 1px 5px;
        border-radius: 4px;
      }
      .add-form {
        min-width: unset;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class SettingsPage {
  private api = inject(ApiService);

  protected types = signal<RecordType[]>([]);
  protected loading = signal(true);
  protected saving = signal(false);

  protected label = '';
  protected icon = '';
  protected extraFields = '';

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listRecordTypes().subscribe({
      next: (t) => {
        this.types.set(t);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected fieldCount(t: RecordType): number {
    if (!t.schema_json) return 0;
    try {
      const arr = JSON.parse(t.schema_json);
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  }

  protected add(): void {
    if (!this.label.trim()) return;
    this.saving.set(true);
    const fields: ExtraField[] = this.extraFields
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((labelText) => ({
        key: labelText.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
        label: labelText,
        type: 'text' as const,
      }));
    this.api
      .createRecordType({
        label: this.label.trim(),
        icon: this.icon.trim() || 'label',
        schema_json: JSON.stringify(fields),
      })
      .subscribe({
        next: () => {
          this.label = '';
          this.icon = '';
          this.extraFields = '';
          this.saving.set(false);
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }
}
