import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../core/api.service';
import { DocumentMeta, FamilyMember } from '../../core/models';
import { ConfirmDialog } from '../../shared/confirm-dialog';

@Component({
  selector: 'app-documents-page',
  imports: [
    DatePipe,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Documents</h1>
          <p class="page-subtitle">Scans, PDFs and images, stored in Cloudflare R2.</p>
        </div>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="member-filter">
          <mat-label>Family member</mat-label>
          <mat-select [ngModel]="selected()" (ngModelChange)="selected.set($event)">
            <mat-option [value]="'all'">All</mat-option>
            <mat-option [value]="'unfiled'">Unfiled</mat-option>
            @for (m of members(); track m.id) {
              <mat-option [value]="m.id">{{ m.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <span class="spacer"></span>
        <button mat-flat-button color="primary" [disabled]="uploading()" (click)="fileInput.click()">
          <mat-icon>upload_file</mat-icon>
          {{ uploading() ? 'Uploading…' : uploadLabel() }}
        </button>
        <input #fileInput type="file" hidden (change)="onFile($event)" />
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (filtered().length === 0) {
        <div class="empty-state"><mat-icon>folder_open</mat-icon><p>No documents here yet.</p></div>
      } @else {
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>File</th><th>Member</th><th>Size</th><th>Uploaded</th><th></th></tr>
            </thead>
            <tbody>
              @for (d of filtered(); track d.id) {
                <tr>
                  <td>
                    <a [href]="url(d.id)" target="_blank" rel="noopener" class="doc-link">
                      <mat-icon>insert_drive_file</mat-icon> {{ d.filename }}
                    </a>
                  </td>
                  <td class="muted">{{ d.family_member_name || 'Unfiled' }}</td>
                  <td class="muted">{{ size(d.size_bytes) }}</td>
                  <td class="muted">{{ d.uploaded_at | date: 'medium' }}</td>
                  <td class="row-actions">
                    <a mat-icon-button [href]="url(d.id)" target="_blank" rel="noopener" matTooltip="Open">
                      <mat-icon>download</mat-icon>
                    </a>
                    <button mat-icon-button (click)="remove(d)"><mat-icon>delete</mat-icon></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }
      .member-filter {
        width: 240px;
      }
      .table-wrap {
        background: #fff;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      .data-table th {
        text-align: left;
        font-weight: 500;
        color: #5f6368;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }
      .data-table td {
        padding: 8px 12px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }
      .doc-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #00639b;
        text-decoration: none;
      }
      .doc-link mat-icon {
        font-size: 18px;
        height: 18px;
        width: 18px;
      }
    `,
  ],
})
export class DocumentsPage {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  protected documents = signal<DocumentMeta[]>([]);
  protected members = signal<FamilyMember[]>([]);
  protected loading = signal(true);
  protected uploading = signal(false);
  protected selected = signal<string>('all');

  protected filtered = computed(() => {
    const sel = this.selected();
    if (sel === 'all') return this.documents();
    if (sel === 'unfiled') return this.documents().filter((d) => !d.family_member_id);
    return this.documents().filter((d) => d.family_member_id === sel);
  });

  protected uploadLabel = computed(() => {
    const sel = this.selected();
    if (sel === 'all' || sel === 'unfiled') return 'Upload (unfiled)';
    const m = this.members().find((x) => x.id === sel);
    return m ? `Upload for ${m.name}` : 'Upload';
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({ docs: this.api.listDocuments(), members: this.api.listFamily() }).subscribe({
      next: (res) => {
        this.documents.set(res.docs);
        this.members.set(res.members);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private reload(): void {
    this.api.listDocuments().subscribe((d) => this.documents.set(d));
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const sel = this.selected();
    const familyMemberId = sel === 'all' || sel === 'unfiled' ? undefined : sel;
    this.uploading.set(true);
    this.api.uploadDocument(file, { familyMemberId }).subscribe({
      next: () => {
        input.value = '';
        this.uploading.set(false);
        this.reload();
      },
      error: () => this.uploading.set(false),
    });
  }

  protected url(id: string): string {
    return this.api.documentDownloadUrl(id);
  }

  protected size(bytes: number | null): string {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected remove(d: DocumentMeta): void {
    this.dialog
      .open(ConfirmDialog, {
        data: { title: `Delete "${d.filename}"?`, message: 'This file will be permanently removed from storage.', confirmLabel: 'Delete', danger: true },
      })
      .afterClosed()
      .subscribe((ok) => ok && this.api.deleteDocument(d.id).subscribe(() => this.reload()));
  }
}
