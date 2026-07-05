import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/api.service';
import { FamilyMember, RecordType, ScheduleItem } from '../../core/models';

export interface ScheduleDialogData {
  item?: ScheduleItem;
  familyMemberId?: string;
  members: FamilyMember[];
  recordTypes: RecordType[];
}

@Component({
  selector: 'app-schedule-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ editing ? 'Edit' : 'Add' }} scheduled item</h2>
    <mat-dialog-content>
      <form class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Family member</mat-label>
          <mat-select [(ngModel)]="model.family_member_id" name="member" [disabled]="lockMember" required>
            @for (m of data.members; track m.id) {
              <mat-option [value]="m.id">{{ m.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>What's due</mat-label>
          <input matInput [(ngModel)]="model.title" name="title" required placeholder="e.g. Tdap booster" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Type (so it can be logged when done)</mat-label>
          <mat-select [(ngModel)]="model.record_type_id" name="type">
            <mat-option [value]="null">— none —</mat-option>
            @for (t of data.recordTypes; track t.id) {
              <mat-option [value]="t.id">{{ t.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Due date</mat-label>
          <input matInput type="date" [(ngModel)]="model.due_date" name="due" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Recurrence (optional)</mat-label>
          <input matInput [(ngModel)]="model.recurrence" name="recurrence" placeholder="e.g. yearly" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" [(ngModel)]="model.notes" name="notes"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!model.title || !model.family_member_id || saving()"
        (click)="save()"
      >
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ScheduleDialog {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<ScheduleDialog>);
  protected data = inject<ScheduleDialogData>(MAT_DIALOG_DATA);

  protected readonly editing = !!this.data.item;
  protected readonly lockMember = !!this.data.familyMemberId && !this.data.item;
  protected saving = signal(false);

  protected model: Partial<ScheduleItem> = {
    family_member_id: this.data.item?.family_member_id ?? this.data.familyMemberId ?? undefined,
    record_type_id: this.data.item?.record_type_id ?? null,
    title: this.data.item?.title ?? '',
    due_date: this.data.item?.due_date ?? null,
    recurrence: this.data.item?.recurrence ?? null,
    notes: this.data.item?.notes ?? null,
  };

  protected save(): void {
    if (!this.model.title || !this.model.family_member_id) return;
    this.saving.set(true);
    const req = this.editing
      ? this.api.updateScheduleItem(this.data.item!.id, this.model)
      : this.api.createScheduleItem(this.model);
    req.subscribe({
      next: (s) => this.ref.close(s),
      error: () => this.saving.set(false),
    });
  }
}
