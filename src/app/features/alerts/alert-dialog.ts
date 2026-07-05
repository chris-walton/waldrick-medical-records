import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/api.service';
import { AlertItem, AlertSeverity, FamilyMember } from '../../core/models';

export interface AlertDialogData {
  members: FamilyMember[];
  familyMemberId?: string;
}

@Component({
  selector: 'app-alert-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>New alert</h2>
    <mat-dialog-content>
      <form class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Family member (optional)</mat-label>
          <mat-select [(ngModel)]="model.family_member_id" name="member">
            <mat-option [value]="null">— whole family —</mat-option>
            @for (m of data.members; track m.id) {
              <mat-option [value]="m.id">{{ m.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Severity</mat-label>
          <mat-select [(ngModel)]="model.severity" name="severity">
            <mat-option value="info">Info</mat-option>
            <mat-option value="warning">Warning</mat-option>
            <mat-option value="urgent">Urgent</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Title</mat-label>
          <input matInput [(ngModel)]="model.title" name="title" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Message</mat-label>
          <textarea matInput rows="2" [(ngModel)]="model.message" name="message"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Due date (optional)</mat-label>
          <input matInput type="date" [(ngModel)]="model.due_date" name="due" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!model.title || saving()" (click)="save()">
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class AlertDialog {
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<AlertDialog>);
  protected data = inject<AlertDialogData>(MAT_DIALOG_DATA);

  protected saving = signal(false);

  protected model: Partial<AlertItem> & { severity: AlertSeverity } = {
    family_member_id: this.data.familyMemberId ?? null,
    severity: 'info',
    title: '',
    message: null,
    due_date: null,
  };

  protected save(): void {
    if (!this.model.title) return;
    this.saving.set(true);
    this.api.createAlert(this.model).subscribe({
      next: (a) => this.ref.close(a),
      error: () => this.saving.set(false),
    });
  }
}
